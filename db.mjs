// add your code here!
import mongoose from 'mongoose';
import { config } from 'dotenv';
import passportLocalMongoose from 'passport-local-mongoose';
config();
mongoose.connect(process.env.DSN);
//user schema
const User = new mongoose.Schema({
    username:String,
    password:String,
    chatrooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" }],//way of referencing other schemas
    SID:String
});
//chatroom schema
const Chatroom = new mongoose.Schema({
    name: String,
    createdAt: Date,
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
})
//message schema
const Message = new mongoose.Schema({
    user:String,
    chatRoom: String,
    content:String,
    createdAt:Date
})
User.plugin(passportLocalMongoose);

mongoose.model('User',User);
mongoose.model("Chatroom",Chatroom)
mongoose.model("Message",Message)