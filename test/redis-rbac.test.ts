import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as RedisRbac from '../lib/redis-rbac-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new RedisRbac.RedisRbacStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
