import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import elasticache = require('@aws-cdk/aws-elasticache');
import lambda = require('@aws-cdk/aws-lambda');
import path = require('path');
import secretsmanager = require('@aws-cdk/aws-secretsmanager')
import { RedisRbacUser } from  "./redis-rbac-secret-manager"

import fs = require('fs');

import { setFlagsFromString } from 'v8';


export class RedisRbacStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const redis_admin = new iam.User(this, "RedisAdmin", {
      userName: 'RedisAdmin',
    });

    const redis_readers = new iam.Group(this, "RedisReaders", {
      groupName: 'RedisReaders'
    });

    //------------------------------
    // Configure VPC and Networking
    //------------------------------
    const vpc = new ec2.Vpc(this, "Vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });


    const secretsManagerEndpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE
      }
    });

    secretsManagerEndpoint.connections.allowDefaultPortFromAnyIpv4();

    const ecSecurityGroup = new ec2.SecurityGroup(this, 'ElastiCacheSG', {
      vpc: vpc,
      description: 'SecurityGroup associated with the ElastiCache Redis Cluster'
    });

    ecSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(6379), 'Redis ingress 6379')

    const publicEcSecurityGroup = new ec2.SecurityGroup(this, 'PublicElastiCacheSG', {
      vpc: vpc,
      description: 'PUBLIC SecurityGroup associated with the ElastiCache Redis Cluster'
    });
    ecSecurityGroup.addIngressRule(ec2.Peer.ipv4('205.251.233.182/32'), ec2.Port.tcp(6379), 'Public Redis ingress 6379')

    let privateSubnets: string[] = []
    vpc.privateSubnets.forEach(function(value){
      privateSubnets.push(value.subnetId)
    });

    //------------------------------
    // Create a RedisRBACUser
    //------------------------------
    // Order of execution:
    // 1) Create an AWS IAM user, role or group which will access the redis cluster
    // 2) Create an AWS SecretsManager secret which will be the auto generated secret string
    //    a) input parameters: redis-username, group
    // 3) Create custom resource to create a Redis RBAC user/group using username, password from step 2
    //    a) input parameters: redis-username, user-group name, cluster-name
    //    b) custom resource will access secret for redis-username and create RBAC user and assign to user-group and cluster
    const userOne = new RedisRbacUser(this, "testuser1", {
      redisUserName: 'userone',
      redisUserId: 'userone',
      accessString: 'on ~* +@all'
    });

    const userTwo = new RedisRbacUser(this, "userTwo", {
      redisUserName: 'usertwo',
      redisUserId: 'user2'
    });

    const readOnlyUser = new RedisRbacUser(this, "readOnlyUser", {
      redisUserName: 'reader',
      redisUserId: 'readonly'
    });

    const mockAppDefaultUser = new RedisRbacUser(this, "mockAppDefaultUser", {
      redisUserName: 'default',
      redisUserId: 'mock-app-default-user'
    });

    const mockAppUserGroup = new elasticache.CfnUserGroup(this, 'mockAppUserGroup', {
      engine: 'redis',
      userGroupId: 'mock-app-user-group',
      userIds: [userOne.getUserId(), userTwo.getUserId(), mockAppDefaultUser.getUserId(), readOnlyUser.getUserId()]
    })

    mockAppUserGroup.node.addDependency(userOne);
    mockAppUserGroup.node.addDependency(userTwo);
    mockAppUserGroup.node.addDependency(mockAppDefaultUser);
    mockAppUserGroup.node.addDependency(readOnlyUser);

    //------------------------------
    // Configure ElastiCache Redis Cluster
    //------------------------------
    const ecSubnetGroup = new elasticache.CfnSubnetGroup(this, 'ElastiCacheSubnetGroup', {
      description: 'Elasticache Subnet Group',
      subnetIds: privateSubnets,
      cacheSubnetGroupName: 'RedisSubnetGroup'
    });

    const ecClusterReplicationGroup = new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupDescription: 'RedisReplicationGroup-RBAC-Demo',
      replicationGroupId: 'RedisReplicationGroup',
      atRestEncryptionEnabled: true,
      multiAzEnabled: true,
      cacheNodeType: 'cache.m4.large',
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
    //------------------------------
    // Configure Mock Application
    //------------------------------

    // Create a lambda layer for redis python library
    const redis_py_layer = new lambda.LayerVersion(this, 'redispy_Layer', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/lib/redis_module/redis_py.zip')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_8, lambda.Runtime.PYTHON_3_7, lambda.Runtime.PYTHON_3_6],
      description: 'A layer that contains the redispy module',
      license: 'MIT License'
    });

    // Create a role for the Lambda
    const mock_app_role = new iam.Role(this, 'MockApplication-Role', {
      roleName: 'MockApplicationLambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role to be assumed by mock application lambda',
    });

    mock_app_role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    mock_app_role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"));
    userOne.getSecret().grantRead(mock_app_role)

    const mock_app = new lambda.Function(this, 'MockApplication', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'redis_connect.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/mock_app.zip')),
      layers: [redis_py_layer],
      role: mock_app_role,
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE},
      securityGroups: [ecSecurityGroup],
      environment: {
        redis_endpoint: ecClusterReplicationGroup.attrPrimaryEndPointAddress,
        redis_port: ecClusterReplicationGroup.attrPrimaryEndPointPort,
        secret_arn: userOne.getSecret().secretArn,
      }
    });

    mock_app.node.addDependency(redis_py_layer);
    mock_app.node.addDependency(ecClusterReplicationGroup);
    mock_app.node.addDependency(vpc);
    mock_app.node.addDependency(mock_app_role);


  }

}
