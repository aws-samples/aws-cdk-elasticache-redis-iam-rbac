#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RedisRbacStack } from '../lib/redis-rbac-stack';

const app = new cdk.App();
new RedisRbacStack(app, 'RedisRbacStack');
