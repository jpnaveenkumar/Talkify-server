const { v1: uuidv1 } = require('uuid');
const constants = require('./constants');
var channels = {};
var users = {}
module.exports = {

    handlePrivateMessage: (req, res) => {
        var data = req.body;
        var channelName = data["channelName"];
        var senderId = data["senderId"];
        var receiverId = data["receiverId"];
        var message = data["message"];
        var isAnonymous = data["isAnonymous"];
        var response = {}
        if(channels[channelName] && users[senderId] && users[receiverId] && message){
            var result = {};
            result["message_type"] = "Chat_Message";
            result["status"] = constants.SUCCESS;
            result["message"] = message;
            result["isPrivate"] = true;
            if(!isAnonymous){
                result["sender_name"] = users[senderId]["userName"];
                result["senderId"] = senderId;
            }else{
                result["sender_name"] = "Anonymous";
            }
            users[senderId]["ws"].send(JSON.stringify(result));
            users[receiverId]["ws"].send(JSON.stringify(result));
            res.status(201);
            response["data"] = { "message":"SUCCESS"};
        }else{
            res.status(400);
            response["data"] = { "message":"BAD REQUEST"};
        }
        res.json(response);
    },

    broadCastMemberInfo: (channelName, result) => {
        if(channelName in channels){
            var usersList = channels[channelName]["users"];
            console.log("broadcasting message....");
            for(var index = 0; index < usersList.length; index++){
                try{
                    usersList[index]["ws"].send(JSON.stringify(result));
                }
                catch(err){
                    console.log("error while sending message for user ",usersList[index]);
                    console.log(err);
                }
            }
        }
    },
    terminateChannel: (channelName) => {
        if(channelName in channels && channels[channelName]["users"].length == 0){
            delete channels[channelName];
        }
    },
    handleTerminateUser : (channelName, userId) => {
      console.log(channelName+ " " +userId);
      if(channelName in channels){
          if(userId in users){
              var indexToDelete = -1;
              var usersList = channels[channelName]["users"];
              for(var index = 0; index < usersList.length; index++){
                  if(usersList[index]["userId"] == userId){
                      indexToDelete = index;
                      break;
                  }
              }
              channels[channelName]["users"].splice(indexToDelete,1);
              delete users[userId];
              var response = {};
              response["message_type"] = "Member_Info";
              response["status"] = 200;
              response["action"] = "remove";
              response["userId"] = userId;
              module.exports.broadCastMemberInfo(channelName,response);
              module.exports.terminateChannel(channelName);
          }
      }
    },
    terminateUserFromChannel : (req, res) => {
        var data = req.body;
        var channelName = data["channelName"];
        var userId = data["userId"];
        module.exports.handleTerminateUser(channelName, userId);
        res.status(200);
        res.json({"message":"success"});
    },
    joinChannel : (req,res)=>{
        var data = req.body;
        var channelName = data["channelName"];
        var userName = data["userName"];
        var response = {};
        if(channelName in channels){
            user = {};
            user["userName"] = userName;
            user["userId"] = uuidv1();
            user["channel"] = channelName;
            users[user["userId"]] = user;
            response["channelName"] = channelName;
            response["userId"] = user["userId"];
            response["message"] = "user added to channel!!";
            res.status(201);
        }else{
            res.status(400);
            response["message"] = "Sorry Channel does not exists!!";
        }
        var result = {};
        result["data"] = response;
        res.json(result);
    },

    getMembersByChannelName: function(req, res){
        var channelName = req.query.channel;
        console.log(channelName,channels);
        var response = {};
        if(channelName in channels){
            var members = channels[channelName]["users"];
            response["data"] = members;
            res.status(200);
        }else{
            res.status(400);
            response["message"] = "Channel Doesn't Exists";
        }
        res.json(response);
    },

    isChannelExists : function(req,res){
        var channelName = req.query.channel;
        var softCreate = req.query.softCreate == 'true';
        var response = {}
        if(channelName in channels){
            res.status(200);
            response["message"] = "Channel Exists";
        }else{
            if(softCreate){
                channels[channelName] = {
                    "name" : channelName,
                    "users" : []
                };
                res.status(200);
                response["message"] = "Channel Exists";
            }else{
                res.status(400);
                response["message"] = "Channel Does not Exists";
            }
        }
        var result = {};
        result["data"] = response;
        res.json(result);
    },

    createChannel : (req,res)=>{
        var data = req.body;
        var channelName = data["channelName"];
        var userName = data["userName"];
        var response = {};
        if(channelName in channels){
            response["message"] = "Channel already exists !!";
            res.status(400);
        }else{
            channels[channelName] = {
                "name" : channelName,
                "users" : []
            };
            user = {};
            user["userName"] = userName;
            user["userId"] = uuidv1();
            user["channel"] = channelName;
            users[user["userId"]] = user;
            response["channelName"] = channelName;
            response["userId"] = user["userId"];
            response["message"] = "Channel created!!";
            res.status(201);
        }
        var result = {};
        result["data"] = response;
        res.json(result);
    },
    updateUserInChannel: function(userId,channelName,ws){
        var usersList = channels[channelName]["users"];
        for(var index = 0; index < usersList.length; index++){
            if(usersList[index]["userId"] == userId){
                usersList[index]["ws"] = ws;
                return true;
            }
        }
        users[userId]["ws"] = ws;
        channels[channelName]["users"].push(users[userId]);
    },
    establishSocketConnection : function(ws,req){
        //console.log(ws);
        var channelName = req.params["channelName"];
        var userId = req.params["userId"];
        var response = {};
        response["message_type"] = "Connection_Status";
        if(channelName in channels){
            if(userId in users){
                module.exports.updateUserInChannel(userId,channelName,ws);
                response["status"] = constants.SUCCESS;
                response["message"] = "Connection establised with Channel";
            }else{
                response["status"] = constants.INVALID_DATA;
                response["message"] = "Invalid User";
            }
        }else{
            response["status"] = constants.INVALID_DATA;
            response["message"] = "Invalid Channel Name";
        }

        ws.on('message',handleSocketResponse);
        ws.on('open',connectionOpen);
        ws.on('close',connectionClose);
        ws.send(JSON.stringify(response));
        setTimeout(function(){
            var userObj = {...users[userId]};
            userObj["ws"] = null;
            var response = {};
            response["message_type"] = "Member_Info";
            response["status"] = 200;
            response["action"] = "add";
            response["user"] = userObj;
            module.exports.broadCastMemberInfo(channelName,response);
        },5000);

        function connectionOpen(){
            console.log("connection opened");
        }

        function connectionClose(){
            console.log("connection closed");
            console.log(channelName+ " " +userId);
            module.exports.handleTerminateUser(channelName, userId);
        }

        function validateInput(channelName, senderId, message)
        {
            var error = 0;
            if(message == "") { error++; }
            if((channelName in channels) == false) { error++; }
            if((senderId in users) == false) { error++; }
            return error == 0 ? true : false;
        }

        function handleSocketResponse(msg){
            var body = JSON.parse(msg);
            var channelName = body["channelName"];
            var senderId = body["senderId"];
            var message = body["message"];
            var isAnonymous = body["isAnonymous"]
            var result = {};
            result["message_type"] = "Chat_Message";
            if(!validateInput(channelName,senderId,message)){
                result["status"] = constants.INVALID_DATA;
                result["message"] = "Invalid Credentials";
                user[senderId]["ws"].send(JSON.stringify(result));
                return;
            }
            result["status"] = constants.SUCCESS;
            result["message"] = message;
            result["isPrivate"] = false;
            if(!isAnonymous){
                result["sender_name"] = users[senderId]["userName"];
                result["senderId"] = senderId;
            }else{
                result["sender_name"] = "Anonymous";
            }
            var usersList = channels[channelName]["users"];
            for(var index = 0; index < usersList.length; index++){
                usersList[index]["ws"].send(JSON.stringify(result));
            }
        }
    }
}
