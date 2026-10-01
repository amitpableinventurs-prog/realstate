import express from 'express';
import { adminProtect } from '../middleware/authMiddleware.js';
import {
  listPublishedPosts, getPublishedPost,
  adminListPosts, adminCreatePost, adminUpdatePost, adminDeletePost,
} from '../controller/blogController.js';

const blogRouter = express.Router();

// Admin (mounted before /posts/:slug so "admin" is never read as a slug)
blogRouter.get('/admin/posts', adminProtect, adminListPosts);
blogRouter.post('/admin/posts', adminProtect, adminCreatePost);
blogRouter.put('/admin/posts/:id', adminProtect, adminUpdatePost);
blogRouter.delete('/admin/posts/:id', adminProtect, adminDeletePost);

// Public
blogRouter.get('/posts', listPublishedPosts);
blogRouter.get('/posts/:slug', getPublishedPost);

export default blogRouter;
