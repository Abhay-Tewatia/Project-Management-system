class ApiError extends Error {
    constructor(
        statusCode,
        message = "something went wrong",
        error = [],
        stack = ""
    ) {
        // Call parent Error constructor
        super(message);

        this.statusCode = statusCode;
        this.error = error;
        this.data = null;
        this.message = message;
        this.success = false;

        // Stack trace handling
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };