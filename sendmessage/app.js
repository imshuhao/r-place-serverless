const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME } = process.env;

const OP_DB = "UpdateHistory"

const initDB = (ddb) => {
  var req = [], arr = new Uint8Array(1000);
  
  for(var j=0; j<40; j++) {
    var tmp = []
    for(var i=0; i<25; i++) {
      tmp.push({
        PutRequest: {
          Item: {
            board_row: j*25 + i,
            row_bit: arr
          }
        }
      })
    }
    req.push(tmp)
  }
    
  for(var j=0; j<40; j++) {
    ddb.batchWrite({
      RequestItems: {
        "Bitmap": req[j]
      }
    }, function(err, data) {
      if (err) console.log(err);
    });
  }
}

function chunkSubstr(str, size) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }

  return chunks;
}


//==========Send Board

async function sendBoard (ddb, apigwManagementApi, event) {
  const data_all = await ddb.scan({ TableName: "Bitmap", ProjectionExpression: 'board_row, row_bit' }).promise();
  var data_all_item = data_all.Items;
  
  data_all_item.sort((a, b) => {
    if (a.board_row < b.board_row) return -1;
    if (a.board_row > b.board_row) return 1;
    return 0;
  })
  
  var res = data_all_item.map((r) => r.row_bit);
  // console.log(res);
  
  var payload = Buffer.concat(res).toString('base64');
  console.log(payload.length);
  let chunks = chunkSubstr(payload.concat("--EOF--"), 24500);
  
  
  for (let i = 0; i< chunks.length; ++i) {
    await apigwManagementApi.postToConnection({ 
      ConnectionId: event.requestContext.connectionId, 
      Data: chunks[i]
    }).promise();
  }

  return { statusCode: 200, body: 'Board data sent.' };
}


//======= handler

exports.handler = async event => {
  let connectionData;
  
  try {
    connectionData = await ddb.scan({ TableName: TABLE_NAME, ProjectionExpression: 'connectionId' }).promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }
  
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  
  const body = JSON.parse(event.body);
  var row = Math.floor(body.position/1000);
  var col = body.position%1000;
  var color = body.color;

  if(body.init) {
    initDB(ddb);
  }
  
  
  if (body.giveMeData) {
    return sendBoard(ddb, apigwManagementApi, event);
  }

  if (body.color && body.position) {
    const putData = {
      TableName: OP_DB,
      Item: {
        connID: event.requestContext.connectionId,
        ts: Date.now(),
        color: body.color,
        position: body.position
      }
    };
    const tsNow = Date.now();
    const getUserTimestamps = {
      KeyConditionExpression: 'connID = :hkey and ts > :rkey',
      ExpressionAttributeValues: {
        ':hkey': event.requestContext.connectionId,
        ':rkey': tsNow - 15000
      },
      Limit: 1,
      ProjectionExpression: "ts", 
      TableName: OP_DB
     };
     
  // spam protection
   try {
    const timestamps = await ddb.query(getUserTimestamps).promise();
    if (timestamps.Count !== 0) {
      await apigwManagementApi.postToConnection({ 
        ConnectionId: event.requestContext.connectionId, 
        Data: "COOLDOWN " + (timestamps.Items[0].ts - tsNow + 300000)/1000
      }).promise();
      return { statusCode: 403, body: 'Cooldown'};
    }
   } catch (err){
     console.log(JSON.stringify(err));
    // return { statusCode: 500, body: 'Failed to store to Operations: ' + JSON.stringify(err)};
   }
  
    try {
      ddb.put(putData, (e, d) => {
        if(e) console.log(e);
        else console.log("stored to Operations");
      });
    } catch (err) {
      return { statusCode: 500, body: 'Failed to store to Operations: ' + JSON.stringify(err)};
    }
  
  
    var getRowData = {
      TableName : 'Bitmap',
      Key: {
        board_row: row
      }
    };
    const rowDataEntry = await ddb.get(getRowData).promise();
    var rowBit = rowDataEntry.Item.row_bit;
    rowBit[col] = color;
  
    var putRowData = {
      TableName: 'Bitmap',
      Item: {
        board_row: row,
        row_bit: rowBit
      }
    };
  
    try {
      ddb.put(putRowData, (e, d) => {
        if(e) console.log(e);
        else console.log("stored to Bitmap");
      });
    } catch (err) {
      return { statusCode: 500, body: 'Failed to store to Bitmap: ' + JSON.stringify(err)};
    }

}


  const postCalls = connectionData.Items.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: event.body }).promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: TABLE_NAME, Key: { connectionId } }).promise();
      } else {
        throw e;
      }
    }
  });
  
  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: 'Data sent.' };
};
