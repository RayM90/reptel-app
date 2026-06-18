import { Router } from 'express';
import { getProducts, getProductsByCategory } from './products.controller';

const router = Router();

router.get('/categories', getProductsByCategory);
router.get('/', getProducts);

export default router;