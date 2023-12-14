const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const Busboy = require('busboy');

const bucketName = "{your bucket}";
const region = "eu-west-1";

const loggerKey = '{your unique logger identifier to make logs easier to read}';

const s3Client = new S3Client({ region: region });

exports.handler = async (event) => {

  console.log(`${loggerKey} - lambda handler - invoked`);

  let success = true;
  let completedFiles = [];
  
  const processFormData = new Promise((resolve, reject) => {
      
      try {
        
          console.log(`${loggerKey} - processFormData - invoked`);

          const busboy = Busboy({ headers: event.headers });
          
          let files = [];
          let fields = [];
      
          console.log(`${loggerKey} - processFormData - on file listener intialized`);
          
          busboy.on('file', function(pFieldnameOnFile, pFileOnFile, pFileMetaOnFile) {
  
              console.log(`${loggerKey} - processFormData - on file triggered`);

              const lFieldname    = pFieldnameOnFile;
              const lFile         = pFileOnFile;
              const lFileName     = pFileMetaOnFile.filename;
              const lEncoding     = pFileMetaOnFile.encoding;
              const lMimetype     = pFileMetaOnFile.mimeType;
              
              const lFileData = [];
  
              console.log(`${loggerKey} - processFormData - processing file: ${lFileName}`);
  
              lFile.on('data', function(data) {
                  lFileData.push(data);
              });
  
              lFile.on('end', function() {
  
                  const lFileSize = Buffer.concat(lFileData).length;
  
                  console.log(`${loggerKey} - processFormData - file processed and added for s3 upload: <${lFileName}> (${lFileSize}`);
                  files.push({
                      fieldname: lFieldname,
                      file: Buffer.concat(lFileData),
                      filename: lFileName,
                      encoding: lEncoding,
                      mimetype: lMimetype
                  });
  
              });
  
          });
      
          console.log(`${loggerKey} - processFormData - on field listener intialized`);
  
          busboy.on('field', function(pFieldnameOnField, pValueOnField) {
   
              console.log(`${loggerKey} - processFormData - on field triggered`);
  
              console.log(`${loggerKey} - processFormData - processing field: ${pFieldnameOnField}`);
              fields.push({
                  fieldname: pFieldnameOnField,
                  value: pValueOnField
              });
  
          });
      
          console.log(`${loggerKey} - processFormData - on finsish listener intialized`);
  
          // All parts have been processed
          busboy.on('finish', async function() {
  
              console.log(`${loggerKey} - processFormData - on finsish triggered`);
  
              let folder;
              let owner;
              let recipient;
  
              for (let field of fields) {
  
                  console.log(`${loggerKey} - processFormData - field [${field.fieldname}]: value: ${field.value}`);
                  if (field.fieldname === 'reference') {
                      let tempFolderString = field.value;
                      folder = tempFolderString.replace(/[\/\\]/g, '-');
                  } else if (field.fieldname === 'owner') {
                      owner = field.value;
                  } else if (field.fieldname === 'recipient') {
                      recipient = field.value;
                  }  
  
              }
              
              if (!folder) {
                  reject("No reference has been supplied.");
              }
  
              console.log(`${loggerKey} - processFormData - amount of files processed: ${files.length}`);
  
              if (files.length < 1) {
                  success = false;
              } else {
  
                  console.log(`${loggerKey} - processFormData - connecting to bucket: ${bucketName}`);
                  
                  const tag = `Folder=${folder?folder:'unspecified'}&Owner=${owner?owner:'unspecified'}&Recipient=${recipient?recipient:'unspecified'}`;
  
                  console.log(`${loggerKey} - processFormData - tagging as: ${tag}`);

                  for (let file of files) {
  
                      console.log(`${loggerKey} - processFormData - processing file to S3 object`, file);
  
                      let epochTimeMilliseconds = Date.now();

                      let key = folder + '/' + file.filename;
                      let veryUniqueKey = key.indexOf('.') > 0 ? 
                                          key.replace('.', `-${epochTimeMilliseconds}.`) :
                                          key + `-${epochTimeMilliseconds}`; 
                      
                      const s3Params = {
                          Bucket: bucketName,
                          Key: veryUniqueKey,
                          Body: file.file,
                          Tagging: tag
                      };
              
                      try {
                          
                          const putObjectCommand = new PutObjectCommand(s3Params);

                          console.log(`${loggerKey} - processFormData - preparing to upload object to S3: ${s3Params.Key}`);
                          const uploadResult = await uploadFileToS3(s3Client, putObjectCommand);
                          
                          //ETag is a hash of the object, not an identifier of the object
                          let eTag = uploadResult.ETag;
                          console.log(`${loggerKey} - processFormData - file uploaded to S3 has en ETag of ${eTag}`); 
                          
                          completedFiles.push({key:veryUniqueKey, ETag : eTag});

                      } catch (error) {

                          console.log(`${loggerKey} - processFormData - File uploaded failed`, error);

                          success = false;                            
                          
                      }
                      
                  }
  
                  console.log(`${loggerKey} - processFormData - success status: ${success}`);
          
                  resolve(success);
                      
              }
          
          });
      
          console.log(`${loggerKey} - processFormData - write multipart body to busboy parser`);
  
          busboy.write(event.body, event.isBase64Encoded ? 'base64' : 'binary');
          busboy.end();
          
      } catch (error) {
        
          console.log(`${loggerKey} - processFormData - error caught`, error);
        
          reject(error);
  
      }

  });
  
  try {
      
      console.log(`${loggerKey} - lambda handler - executing await processFormData`);

      const success = await processFormData.catch(error => {
          console.log(`${loggerKey} - lambda handler - processFormData.catch error caught`, error);
          throw Error(error);
      });

      console.log(`${loggerKey} - lambda handler - processed processFormData: ${success}`);

      console.log(`${loggerKey} - lambda handler - request completed successfully`);
  
      const response = {
          statusCode : 200,
          body : JSON.stringify({
              message : 'File(s) uploaded successfully',
              filesUploaded : completedFiles
          })
      };

      return response;
  
  } catch (error) {

      console.log(`${loggerKey} - lambda handler - request completed with error`);

      const response = {
          statusCode : 500,
          body : JSON.stringify({
              message : 'Some or all files could not upload. Completed files listed.',
              filesUploaded : completedFiles
          })
      };

      return response;
  
  }

};

async function uploadFileToS3(s3Client, putObjectCommand) {
  
  console.log(`${loggerKey} - uploadFileToS3`, putObjectCommand);
  
  try {
  
      const result = await s3Client.send(putObjectCommand);
      
      console.log(`${loggerKey} - uploadFileToS3 - success`, result);
      
      return result;

      
  } catch (error) {
      
      console.log(`${loggerKey} - uploadFileToS3 - catched error`, error);

      return error;
      
  }
  
}
