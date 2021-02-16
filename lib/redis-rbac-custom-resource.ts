import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import customResource = require('@aws-cdk/custom-resources');
import iam = require('@aws-cdk/aws-iam');
import elasticache = require('@aws-cdk/aws-elasticache');
import lambda = require('@aws-cdk/aws-lambda');
import path = require('path');
import secretsmanager = require('@aws-cdk/aws-secretsmanager')
import fs = require('fs');
import { CustomResource } from '@aws-cdk/core';
import { countResources } from '@aws-cdk/assert';


export interface RedisRbacUserProps {

  // vpc: ec2.IVpc;
  // elastiCacheSecurityGroups: [ec2.SecurityGroup];
  // elastiCacheReplicationGroup: elasticache.CfnReplicationGroup;
  redisUserName: string;
  redisUserId: string;
  accessString?: string;
}


export class RedisRbacUser extends cdk.Construct {
  public readonly response: string;

  private rbacUserSecret: secretsmanager.Secret;
  private rbacUserName: string;
  private rbacUserId: string;

  public getSecret(): secretsmanager.Secret {
    return this.rbacUserSecret
  }

  public getUserName(): string {
    return this.rbacUserName
  }

  public getUserId(): string{
    return this.rbacUserId
  }

  constructor(scope: cdk.Construct, id: string, props: RedisRbacUserProps) {
    super(scope, id);
    this.rbacUserSecret = new secretsmanager.Secret(this, 'secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: props.redisUserName }),
        generateStringKey: 'password',
        excludeCharacters: ',"/@'
      },
    });

    this.rbacUserId = props.redisUserId
    this.rbacUserName = props.redisUserName

    const user = new elasticache.CfnUser(this, 'redisuser', {
      engine: 'redis', //Mirus Todo: File a bug: docs say this has to be 'Redis' but 'redis' is the correct casing
      userName: props.redisUserName,
      accessString: props.accessString? props.accessString : "off +get ~keys*", // Mirus Todo: File a bug: this is required even though the docs say that it isn't -- result is 500 internal error on service ElastiCache
      userId: props.redisUserId,
      passwords: [this.rbacUserSecret.secretValue.toString()]
    })




    // Create a role for the Lambda
    // const rbacCustomResourceRole = new iam.Role(this, 'RbacCR-'+props.redisUserName, {
    //   assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    //   description: 'Role to be assumed by mock application lambda',
    // });

    // rbacCustomResourceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    // rbacCustomResourceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"));

    // rbacUserSecret.grantRead(rbacCustomResourceRole)


    // const onEvent = new lambda.Function(this, 'onEventHandler', {
    //   runtime: lambda.Runtime.PYTHON_3_7,
    //   handler: 'custom_resource_handler.lambda_handler',
    //   code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/rbac_cr.zip')),
    //   // layers: [redis_py_layer],
    //   role: rbacCustomResourceRole,
    //   vpc: props.vpc,
    //   vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE},
    //   securityGroups: props.elastiCacheSecurityGroups,
    //   timeout: cdk.Duration.seconds(10),
    //   environment: {
    //     redis_endpoint: props.elastiCacheReplicationGroup.attrPrimaryEndPointAddress,
    //     redis_port: props.elastiCacheReplicationGroup.attrPrimaryEndPointPort,
    //     secret_arn: rbacUserSecret.secretArn,
    //     redis_username: props.redisUserName
    //   }
    // });

    // const rbacUserProvider = new customResource.Provider(this, "RbacUserProvider", {
    //   onEventHandler: onEvent
    // });

    // new cdk.CustomResource(this, props.redisUserName, {
    //   serviceToken: rbacUserProvider.serviceToken
    // })
  }

}
