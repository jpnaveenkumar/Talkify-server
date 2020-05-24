const { v1: uuidv1 } = require('uuid');
const constants = require('./constants');
var channels = {};
var users = {}
module.exports = {

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

    isChannelExists : function(req,res){
        var channelName = req.query.channel;
        var response = {}
        if(channelName in channels){
            res.status(200);
            response["message"] = "Channel Exists";
        }else{
            res.status(400);
            response["message"] = "Channel Does not Exists";
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
        ws.send(JSON.stringify(response));

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
            result["sender_name"] = users[senderId]["userName"];
            var usersList = channels[channelName]["users"];
            for(var index = 0; index < usersList.length; index++){
                usersList[index]["ws"].send(JSON.stringify(result));
            }
        }
    }
}