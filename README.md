# lambdas3apigatewaymultipart
This repo shows an example nodejs aws lambda which processes a multipart payload from a form like submission to save the files to s3.

So what you need to do create a bucket ({your bucket}).

Create a nodejs lambda (I used node 18).

Use the code in index.json for your lambda.

Edit the lambda with {your bucket} and {your unique logger identifier to make logs easier to read}.

Remember to install your busboy dependency: npm install busboy.

The easiest would be to after installing your dependencies and the node_modules folder is created, to zip the contents of this project folder excluding package-lock.json and the test.html (so only the node_modules directory and the index.js file). Then upload this zip as your lambda.

Give the lambda a role/policy to access the S3 bucket (perhaps only this bucket would be good practise)

Create a API gateway, which invokes the lambda.

Give the API gateway a role/policy to execute the lambda.

In test.html remember to edit the line '{your api gateway url along with the endpoint which invokes lambda}'.
