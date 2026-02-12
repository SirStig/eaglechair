try:
    from uvicorn.workers import UvicornWorker

    class AsyncioUvicornWorker(UvicornWorker):
        """
        Custom Uvicorn worker for Gunicorn that forces the usage of asyncio event loop.
        This ignores uvloop even if it is installed.
        """

        CONFIG_KWARGS = {"loop": "asyncio"}

except ImportError:
    # Fallback if uvicorn is not installed (though it should be)
    AsyncioUvicornWorker = None
