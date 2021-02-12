import redis

def lambda_handler(event, context):
    redis_server = redis.Redis(
        host='public-rediscluster-rbac-demo.y03hhj.0001.usw2.cache.amazonaws.com',
        port=6379)

    redis_server.set("name", "orkb")
    result = redis_server.get("name")
    print (result)