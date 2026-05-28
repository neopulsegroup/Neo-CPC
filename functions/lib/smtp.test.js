"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const smtp_1 = require("./smtp");
(0, vitest_1.describe)('smtp', () => {
    (0, vitest_1.it)('buildTransportOptions usa secure=true para ssl', () => {
        const options = (0, smtp_1.buildTransportOptions)({
            host: 'smtp.example.com',
            port: 465,
            security: 'ssl',
            username: 'user',
            password: 'pass',
            fromEmail: 'no-reply@example.com',
        });
        (0, vitest_1.expect)(options).toMatchObject({ host: 'smtp.example.com', port: 465, secure: true });
    });
    (0, vitest_1.it)('buildTransportOptions usa secure=false para tls', () => {
        const options = (0, smtp_1.buildTransportOptions)({
            host: 'smtp.example.com',
            port: 587,
            security: 'tls',
            username: 'user',
            password: 'pass',
            fromEmail: 'no-reply@example.com',
        });
        (0, vitest_1.expect)(options).toMatchObject({ host: 'smtp.example.com', port: 587, secure: false });
    });
});
