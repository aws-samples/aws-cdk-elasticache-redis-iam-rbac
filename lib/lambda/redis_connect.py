import redis
import os
import boto3
import json

def lambda_handler(event, context):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(
        SecretId=os.environ['secret_arn']
    )

    print("The secret is: "+response['SecretString'])
    secret = json.loads(response['SecretString'])

    redis_server = redis.Redis(
        host=os.environ['redis_endpoint'],
        port=os.environ['redis_port'],
        username=secret['username'],
        password=secret['password'],
        ssl=True)

    redis_server.set("name", "orkb")
    result = redis_server.get("name")
    print (result)