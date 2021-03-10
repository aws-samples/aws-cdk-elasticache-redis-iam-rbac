/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import elasticache = require('@aws-cdk/aws-elasticache');
import lambda = require('@aws-cdk/aws-lambda');
import path = require('path');
import { RedisRbacUser } from  "./redis-rbac-secret-manager";

import fs = require('fs');

import { setFlagsFromString } from 'v8';


export class RedisRbacStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -----------------------------------------------------------------------------------------------------------
    // This constructor will deploy resources required to link ElastiCache Redis, with SecretsManager and IAM
    // -----------------------------------------------------------------------------------------------------------
    // Steps:
    // Step 1) create a VPC into which the ElastiCache replication group will be placed
    // Step 2) create Redis RBAC users
    //    a) one secret in Secrets Manager will be created for each
    // Step 3) create IAM roles and grant them read access to the appropriate secret
    // Step 4) create an ElastiCache Redis replication group
    // Step 5) create test functions

    let producerName = 'producer'
    let consumerName = 'consumer'
    let noAccessName = 'outsider'
    let defaultName = 'default'

    // ------------------------------------------------------------------------------------
    // Step 1) Create a VPC into which the ElastiCache replication group will be placed
    //     a) only private subnets will be used
    //     b) a Secrets Manager VPC endpoint will be added to allow access to Secrets Manager
    // ------------------------------------------------------------------------------------

    const vpc = new ec2.Vpc(this, "Vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.ISOLATED,
        }
      ]
    });

    const secretsManagerEndpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: {
        subnetType: ec2.SubnetType.ISOLATED
      }
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: vpc,
      description: 'SecurityGroup into which Lambdas will be deployed'
    });


    const ecSecurityGroup = new ec2.SecurityGroup(this, 'ElastiCacheSG', {
      vpc: vpc,
      description: 'SecurityGroup associated with the ElastiCache Redis Cluster'
    });

    ecSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(6379), 'Redis ingress 6379');

    // ------------------------------------------------------------------------------------
    // Step 2) Create Redis RBAC users
    //     a) access strings will dictate operations that can be performed
    //     b) RedisRbacUser is a class defined in redis-rbac-secret-manager.ts
    //     c) RedisRbacUser is composed of an AWS::ElastiCache::User and a Secret
    // ------------------------------------------------------------------------------------
    const producerRbacUser = new RedisRbacUser(this, producerName+'RBAC', {
      redisUserName: producerName,
      redisUserId: producerName,
      accessString: 'on ~* -@all +SET'
    });

    const consumerRbacUser = new RedisRbacUser(this, consumerName+'RBAC', {
      redisUserName: 'consumer',
      redisUserId: 'consumer',
      accessString: 'on ~* -@all +GET'
    });

    const groupDefaultRbacUser = new RedisRbacUser(this, "groupDefaultUser"+'RBAC', {
      redisUserName: 'default',
      redisUserId: 'groupdefaultuser'
    });

    // Create RBAC user group
    const mockAppUserGroup = new elasticache.CfnUserGroup(this, 'mockAppUserGroup', {
      engine: 'redis',
      userGroupId: 'mock-app-user-group',
      userIds: [producerRbacUser.getUserId(), groupDefaultRbacUser.getUserId(), consumerRbacUser.getUserId()]
    })

    mockAppUserGroup.node.addDependency(producerRbacUser);
    mockAppUserGroup.node.addDependency(groupDefaultRbacUser);
    mockAppUserGroup.node.addDependency(consumerRbacUser);


    // ------------------------------------------------------------------------------------
    // Step 3) Create IAM role and grant them read access to the appropriate SecretsManager secret
    //     a) each IAM role will be assumed by a lambda function
    //     b) each IAM role will be granted read and decrypt permissions to a matching secret
    // ------------------------------------------------------------------------------------
    const producerRole = new iam.Role(this, producerName+'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role to be assumed by producer lambda',
    });

    producerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    producerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"));
    producerRbacUser.grantReadSecret(producerRole)

    const consumerRole = new iam.Role(this, consumerName+'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role to be assumed by mock application lambda',
    });
    consumerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    consumerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"));
    consumerRbacUser.grantReadSecret(consumerRole)

    const noAccessRole = new iam.Role(this, noAccessName+'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role to be assumed by mock application lambda',
    });
    noAccessRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    noAccessRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"));

    // ------------------------------------------------------------------------------------
    // Step 4) Create an ElastiCache Redis Replication group and associate the RBAC user group
    //     a) an ElastiCache subnet group will be created
    //     b) the ElastiCache replication group will be associated with the RBAC user group
    // ------------------------------------------------------------------------------------

    let isolatedSubnets: string[] = []

    vpc.isolatedSubnets.forEach(function(value){
      isolatedSubnets.push(value.subnetId)
    });

    const ecSubnetGroup = new elasticache.CfnSubnetGroup(this, 'ElastiCacheSubnetGroup', {
      description: 'Elasticache Subnet Group',
      subnetIds: isolatedSubnets,
      cacheSubnetGroupName: 'RedisSubnetGroup'
    });

    const ecClusterReplicationGroup = new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupDescription: 'RedisReplicationGroup-RBAC-Demo',
      replicationGroupId: 'RedisReplicationGroup',
      atRestEncryptionEnabled: true,
      multiAzEnabled: true,
      cacheNodeType: 'cache.m6g.large',
      cacheSubnetGroupName: ecSubnetGroup.cacheSubnetGroupName,
      engine: "Redis",
      engineVersion: '6.x',
      numNodeGroups: 1,
      replicasPerNodeGroup: 1,
      securityGroupIds: [ecSecurityGroup.securityGroupId],
      transitEncryptionEnabled: true,
      userGroupIds: [mockAppUserGroup.userGroupId]
    })

    ecClusterReplicationGroup.node.addDependency(ecSubnetGroup)
    ecClusterReplicationGroup.node.addDependency(mockAppUserGroup)


    // ------------------------------------------------------------------------------------
    // Step 5) Create test functions
    //     a) one producer
    //     b) one consumer
    //     c) one that cannot access Redis
    // ------------------------------------------------------------------------------------
    const redisPyLayer = new lambda.LayerVersion(this, 'redispy_Layer', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/lib/redis_module/redis_py.zip')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_8, lambda.Runtime.PYTHON_3_7, lambda.Runtime.PYTHON_3_6],
      description: 'A layer that contains the redispy module',
      license: 'MIT License'
    });


    const producerLambda = new lambda.Function(this, producerName+'Fn', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'redis_connect.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/mock_app.zip')),
      layers: [redisPyLayer],
      role: producerRole,
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
      securityGroups: [lambdaSecurityGroup],
      environment: {
        redis_endpoint: ecClusterReplicationGroup.attrPrimaryEndPointAddress,
        redis_port: ecClusterReplicationGroup.attrPrimaryEndPointPort,
        secret_arn: producerRbacUser.getSecret().secretArn,
      }
    });

    producerLambda.node.addDependency(redisPyLayer);
    producerLambda.node.addDependency(ecClusterReplicationGroup);
    producerLambda.node.addDependency(vpc);
    producerLambda.node.addDependency(producerRole);

    // Create a function that can only read from Redis
    const consumerFunction = new lambda.Function(this, consumerName+'Fn', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'redis_connect.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/mock_app.zip')),
      layers: [redisPyLayer],
      role: consumerRole,
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
      securityGroups: [lambdaSecurityGroup],
      environment: {
        redis_endpoint: ecClusterReplicationGroup.attrPrimaryEndPointAddress,
        redis_port: ecClusterReplicationGroup.attrPrimaryEndPointPort,
        secret_arn: consumerRbacUser.getSecret().secretArn,
      }
    });

    consumerFunction.node.addDependency(redisPyLayer);
    consumerFunction.node.addDependency(ecClusterReplicationGroup);
    consumerFunction.node.addDependency(vpc);
    consumerFunction.node.addDependency(consumerRole);

    // Create a function that cannot access Redis
    const noAccessFunction = new lambda.Function(this, noAccessName+'Fn', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'redis_connect.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/mock_app.zip')),
      layers: [redisPyLayer],
      role: consumerRole,
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
      securityGroups: [lambdaSecurityGroup],
      environment: {
        redis_endpoint: ecClusterReplicationGroup.attrPrimaryEndPointAddress,
        redis_port: ecClusterReplicationGroup.attrPrimaryEndPointPort,
        secret_arn: producerRbacUser.getSecret().secretArn,
      }
    });

    noAccessFunction.node.addDependency(redisPyLayer);
    noAccessFunction.node.addDependency(ecClusterReplicationGroup);
    noAccessFunction.node.addDependency(vpc);
    noAccessFunction.node.addDependency(noAccessRole);

  }

}
