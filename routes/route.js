import express from 'express';

import { saveSendEmails, getEmails, toggleStarredEmail, deleteEmails, 
    moveEmailsToBin } from '../controller/email-controller.js';

import { redisCachingMiddleware } from '../middlewares/redis.js';

const routes = express.Router();

routes.get('/emails/:type', redisCachingMiddleware({ EX: 600 }), getEmails);

routes.post('/save', saveSendEmails);
routes.post('/save-draft', saveSendEmails);
routes.post('/starred', toggleStarredEmail);
routes.delete('/delete', deleteEmails);
routes.post('/bin', moveEmailsToBin);

export default routes;
