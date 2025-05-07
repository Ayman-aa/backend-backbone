"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
var bcrypt = require("bcrypt");
var prisma_1 = require("../utils/prisma");
function authRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /* <-- Register route --> */
            app.post("/register", {
                schema: {
                    body: {
                        type: 'object',
                        required: ['email', 'password', 'username'],
                        properties: {
                            email: { type: 'string', format: 'email' },
                            password: { type: 'string', minLength: 6 },
                            username: { type: 'string', minLength: 3 },
                        }
                    }
                }
            }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, password, username, _b, existingMail, existingUser, hashedPassword, user, token, err_1;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _a = request.body, email = _a.email, password = _a.password, username = _a.username;
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, Promise.all([
                                    prisma_1.prisma.user.findUnique({ where: { email: email } }),
                                    prisma_1.prisma.user.findUnique({ where: { username: username } }),
                                ])];
                        case 2:
                            _b = _c.sent(), existingMail = _b[0], existingUser = _b[1];
                            if (existingMail)
                                return [2 /*return*/, reply.status(400).send({ statusCode: 400, error: "Email already registered" })];
                            if (existingUser)
                                return [2 /*return*/, reply.status(400).send({ statusCode: 400, error: "Username already registered" })];
                            return [4 /*yield*/, bcrypt.hash(password, 10)];
                        case 3:
                            hashedPassword = _c.sent();
                            return [4 /*yield*/, prisma_1.prisma.user.create({
                                    data: {
                                        email: email,
                                        password: hashedPassword,
                                        username: username,
                                    },
                                })];
                        case 4:
                            user = _c.sent();
                            token = app.jwt.sign({ id: user.id, email: user.email });
                            reply.status(201).send({
                                statusCode: 201,
                                message: "User registred successefully",
                                token: token,
                                user: { id: user.id, email: user.email, username: user.username }
                            });
                            return [3 /*break*/, 6];
                        case 5:
                            err_1 = _c.sent();
                            return [2 /*return*/, reply.status(500).send({ statusCode: 500, error: "Registration failed" })];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            /* <-- Register route --> */
            /* <-- Login route --> */
            app.post("/login", {
                schema: {
                    body: {
                        type: 'object',
                        required: ['email', 'password'],
                        properties: {
                            email: { type: 'string', format: 'email' },
                            password: { type: 'string', minLength: 6 },
                        }
                    }
                }
            }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, password, user, match, token;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = request.body, email = _a.email, password = _a.password;
                            return [4 /*yield*/, prisma_1.prisma.user.findUnique({ where: { email: email } })];
                        case 1:
                            user = _b.sent();
                            if (!user)
                                return [2 /*return*/, reply.status(400).send({ statusCode: 400, error: "Email or password is incorrect" })];
                            return [4 /*yield*/, bcrypt.compare(password, user.password)];
                        case 2:
                            match = _b.sent();
                            if (!match)
                                return [2 /*return*/, reply.status(401).send({ statusCode: 401, error: "Email or password is incorrect" })];
                            token = app.jwt.sign({ id: user.id, email: user.email });
                            return [2 /*return*/, reply.status(202).send({
                                    statusCode: 202,
                                    message: "Login successeful",
                                    token: token,
                                    user: { id: user.id, email: user.email, username: user.username }
                                })];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}
