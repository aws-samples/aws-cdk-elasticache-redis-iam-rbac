import redis
import os
def lambda_handler(event, context):
    redis_server = redis.Redis(
        host=os.environ['redis_endpoint'],
        port=os.environ['redis_port'])

    redis_server.set("name", "orkb")
    result = redis_server.get("name")
    print (result)