import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import express from 'express';


const app = express();
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "../client/build")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

const httpServer = http.Server(app);

//cors origin accepts all servers otherwise we get an error in google chrome
const io = new Server(httpServer, { cors: { origin: "*" } });
const users = [];

//handle connection for websockets
io.on("connection", (socket) => {
    //4 events
    
    //happens when user on client-side emits login action, this function then runs in the server and passes user as parameter to this function
    socket.on("onLogin", (user) => {
        //desconstructs the name of the user
        const updatedUser = {
            ...user,
            online: true,
            socketId: socket.id,
            //by default there is no message between user and admin so we set it to default
            messages: [],
        };
        const existUser = users.find((x) => x.name === updatedUser.name);
        if (existUser) {
            existUser.socketId = socket.id;
            existUser.online = true;
        } else {
            users.push(updatedUser);
        }
        const admin = users.find((x) => x.name === "Admin" && x.online);
        if (admin) {
            io.to(admin.socketId).emit("updateUser", updatedUser);
        }
        if (updatedUser.name === "Admin") {
            io.to(updatedUser.socketId).emit("listUsers", users);
        }
    });
    //disconnect this function happens when you close your web browser
    socket.on("disconnect", () => {
        const user = users.find((x) => x.socketId === socket.id);
        if (user) {
            user.online = false;
            const admin = users.find((x) => x.name === "Admin" && x.online);
            if (admin) {
                io.to(admin.socketId).emit("updateUser", user);
            }
        } 
    });
    //when admin clicks on (selects) a user we emit this action to pass selected user as parameter and get messages from the user
    socket.on("onUserSelected", (user) => {
        const admin = users.find((x) => x.name === "Admin" && x.online);
        if (admin) {
            const existUser = users.find((x) => x.name === user.name);
            io.to(admin.socketId).emit("selectUser", existUser);
        }
    });
    //happens when user sends message to admin OR when admin sends message to user
    socket.on("onMessage", (message) => {
        if (message.from === "Admin") {
            const user = users.find((x) => x.name === message.to && x.online);
            if (user) {
                io.to(user.socketId).emit("message", message);
                user.messages.push(message);
            } else {
                io.to(socket.id).emit("message", {
                    from: "System",
                    to: "Admin",
                    body: "User Is Not Online",
                });
            }
        } else {
            const admin = users.find((x) => x.name === "Admin" && x.online);
            if (admin) {
                io.to(admin.socketId).emit("message", message);
                const user = users.find((x) => x.name === message.from && x.online);
                if (user) {
                    user.messages.push(message);
                }
            } else {
                io.to(socket.id).emit("message", {
                    from: "System",
                    to: message.from,
                    body: "Sorry. Admin is not online right now"
                });
            }
        }
    })
})

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
});