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
        excludeCharacters: '@%*()_+=`~{}|[]\\:";\'?,./'
      },
    });

    this.rbacUserId = props.redisUserId
    this.rbacUserName = props.redisUserName

    const user = new elasticache.CfnUser(this, 'redisuser', {
      engine: 'redis', //Mirus Todo: File a bug: docs say this has to be 'Redis' but 'redis' is the correct casing
      userName: props.redisUserName,
      accessString: props.accessString? props.accessString : "off +get ~keys*", // Mirus Todo: File a bug: this is required even though the docs say that it isn't -- result is 500 internal error on service ElastiCache
      userId: props.redisUserId,
      passwords: [this.rbacUserSecret.secretValueFromJson('password').toString()]
    })


    user.node.addDependency(this.rbacUserSecret)

  }

}
