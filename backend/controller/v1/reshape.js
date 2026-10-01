// Runs an existing /api/v1/app (or admin) handler behind a /api/v1 route:
// `body` rewrites the request body into the handler's field names, `prepare`
// loads anything the response mapping needs (it may be async), and `data`
// rewrites a successful response's `data` into the /api/v1 shape.
// `errors` renames field keys in validation errors.
export const reshape = (handler, { body, prepare, data, errors } = {}) => async (req, res, next) => {
    try {
        if (body) req.body = body(req.body || {});
        const ctx = prepare ? await prepare(req) : undefined;
        const json = res.json.bind(res);
        res.json = (payload) => {
            // Only success/message/data are kept; `data` also receives the whole
            // payload for handlers that don't use a data key (e.g. { token })
            if (payload?.success && data) {
                return json({
                    success: true,
                    ...(payload.message && { message: payload.message }),
                    data: data(payload.data, ctx, req, payload),
                });
            }
            if (payload?.success === false && payload.errors && errors) {
                const renamed = Object.fromEntries(
                    Object.entries(payload.errors).map(([key, message]) => [errors[key] || key, message]));
                return json({ ...payload, errors: renamed });
            }
            return json(payload);
        };
        await handler(req, res, next);
    } catch (error) {
        next(error);
    }
};
