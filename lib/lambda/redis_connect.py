import redis
import os
import boto3
import json
from datetime import datetime

def producer_lambda_handler(event, context):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(
        SecretId=os.environ['secret_arn']
    )

    secret = json.loads(response['SecretString'])

    redis_server = redis.Redis(
        host=os.environ['redis_endpoint'],
        port=os.environ['redis_port'],
        username=secret['username'],
        password=secret['password'],
        ssl=True)

    try:
      redis_server.set("time", datetime.now().strftime("%d/%m/%Y %H:%M:%S"))
    except Exception as e:
      print ("Exception trying to SET entry "+e)

    try:
      result = redis_server.get("time")
    except Exception as e:
      print ("Exception trying to GET entry "+e)
    print (result)

def consumer_lambda_handler(event, context):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(
        SecretId=os.environ['secret_arn']
    )

    secret = json.loads(response['SecretString'])

    redis_server = redis.Redis(
        host=os.environ['redis_endpoint'],
        port=os.environ['redis_port'],
        username=secret['username'],
        password=secret['password'],
        ssl=True)

    try:
      result = redis_server.get("time")
    except Exception as e:
      print ("Exception trying to GET entry "+e)
    print (result)