export function inventoryErrorStatus(error: { code?: string; message?: string }): number {
  if (error.code === '42501') return 403;
  if (error.code === '22P02') return 400;
  if (error.code === 'P0002' || error.code === 'PGRST116') return 404;
  if (error.code === 'PT409' || error.code === '40001' || error.code === '23505' || error.code === '55000') return 409;
  if (error.code === '23514' || error.code === '22023' || error.code === '23503') return 400;
  return 500;
}
