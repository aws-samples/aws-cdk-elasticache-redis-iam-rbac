import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import elasticache = require('@aws-cdk/aws-elasticache')
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

    const ecSecurityGroup = new ec2.SecurityGroup(this, 'ElastiCacheSG', {
      vpc: vpc,
      description: 'SecurityGroup associated with the ElastiCache Redis Cluster'
    });

    ecSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(6379), 'Redis ingress 6379')

    let privateSubnets: string[] = []
    vpc.privateSubnets.forEach(function(value){
      privateSubnets.push(value.subnetId)
    });

    const ecSubnetGroup = new elasticache.CfnSubnetGroup(this, 'ElastiCacheSubnetGroup', {
      description: 'Elasticache Subnet Group',
      subnetIds: privateSubnets,
      cacheSubnetGroupName: 'RedisSubnetGroup'
    });

    const ecCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      clusterName: 'RedisCluster-RBAC-Demo',
      cacheNodeType: 'cache.m4.large',
      engineVersion: '6.x',
      numCacheNodes: 1,
      engine: "Redis",
      cacheSubnetGroupName: ecSubnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [ecSecurityGroup.securityGroupId]
    });

    ecCluster.node.addDependency(ecSubnetGroup)

  }
}
