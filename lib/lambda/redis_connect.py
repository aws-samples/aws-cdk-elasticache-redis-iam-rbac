# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this
# software and associated documentation files (the "Software"), to deal in the Software
# without restriction, including without limitation the rights to use, copy, modify,
# merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
# PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

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


