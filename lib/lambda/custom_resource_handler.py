#https://www.npmjs.com/package/@aws-cdk/custom-resources
def lambda_handler(event, context):
  print(event)
  request_type = event['RequestType']
  if request_type == 'Create': return on_create(event)
  if request_type == 'Update': return on_update(event)
  if request_type == 'Delete': return on_delete(event)
  raise Exception("Invalid request type: %s" % request_type)
def on_event(event, context):
  print(event)
  request_type = event['RequestType']
  if request_type == 'Create': return on_create(event)
  if request_type == 'Update': return on_update(event)
  if request_type == 'Delete': return on_delete(event)
  raise Exception("Invalid request type: %s" % request_type)

def on_create(event):
  props = event["ResourceProperties"]
  print("create new resource with props %s" % props)

  # add your create code here...
  physical_id = 'asdfjkl'

  return { 'PhysicalResourceId': physical_id }

def on_update(event):
  physical_id = event["PhysicalResourceId"]
  props = event["ResourceProperties"]
  print("update resource %s with props %s" % (physical_id, props))
  # ...

def on_delete(event):
  physical_id = event["PhysicalResourceId"]
  print("delete resource %s" % physical_id)
  # ...