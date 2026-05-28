"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTransportOptions = buildTransportOptions;
exports.createTransport = createTransport;
const nodemailer_1 = __importDefault(require("nodemailer"));
function buildTransportOptions(settings) {
    return {
        host: settings.host,
        port: settings.port,
        secure: settings.security === 'ssl',
        auth: {
            user: settings.username,
            pass: settings.password,
        },
    };
}
function createTransport(settings) {
    const options = buildTransportOptions(settings);
    return nodemailer_1.default.createTransport(options);
}
