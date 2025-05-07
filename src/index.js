"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fastify_1 = require("fastify");
var auth_1 = require("./routes/auth");
var dotenv = require("dotenv");
dotenv.config();
var jwt_1 = require("./plugins/jwt");
// import oauth2Plugin from './plugins/oauth2';
// import protectedRoutes from './routes/protected';
var app = (0, fastify_1.default)();
app.register(jwt_1.default);
// await app.register(oauth2Plugin);
// await app.register(protectedRoutes, { prefix: '/protected' });
app.register(auth_1.default, { prefix: '/auth' });
app.listen({ port: 3000 }, function (err) {
    console.log("\n    \u001B[38;2;255;100;100m\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n    \u001B[38;2;255;150;100m\u2551 \u001B[1mSERVER STARTED SUCCESSFULLY \u001B[0m\u001B[38;2;255;150;100m\u2551\n    \u001B[38;2;255;200;100m\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n    \u001B[0m\u27A4 Access URL: \u001B[4m\u001B[36mhttp://localhost:3000\u001B[0m\n  ");
    if (err)
        throw err;
});
