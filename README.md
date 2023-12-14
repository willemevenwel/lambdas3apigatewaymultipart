# lambdas3apigatewaymultipart
This repo shows an example nodejs aws lambda which processes a multipart payload from a form like submission to save the files to s3.

So what you need to do create a bucket ({your bucket}).

Create a nodejs lambda (I used node 18).

Give the lambda a role/policy to access the S3 bucket (perhaps only this bucket would be good practise)

Create a API gateway, which invokes the lambda.

Give the API gateway a role/policy to execute the lambda.
