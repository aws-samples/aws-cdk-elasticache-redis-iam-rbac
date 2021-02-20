import redis
import os
import boto3
import json
from datetime import datetime

def lambda_handler(event, context):
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
      time_now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
      redis_server.set("time", time_now)
      print ("Successfully set key 'time' to "+time_now)
    except Exception as e:
      print ("Exception trying to SET entry "+str(e))

    try:
      result = redis_server.get("time")
      print ("Successfully retrieved key 'time' "+str(result))
    except Exception as e:
      print ("Exception trying to GET entry "+str(e))


