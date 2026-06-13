"""
Loads configuration from the .env file. Edit .env, NOT this file.

Everything in the server reads its settings from here, so there is exactly one
place to change behaviour: the .env file sitting next to this module.
"""
import os
from pathlib import Path
from dataclasses import dataclass, field

from dotenv import load_dotenv

# Reads ".env" from the current working directory (the web_server/ folder when
# the server is started by run.sh). Missing file is fine — defaults below apply.
load_dotenv()


def _as_bool(value: str) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Config:
    host: str = os.getenv("CT_HOST", "127.0.0.1")
    port: int = int(os.getenv("CT_PORT", "8000"))

    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")

    source_lang: str = os.getenv("DEFAULT_SOURCE_LANG", "Japanese")
    target_lang: str = os.getenv("DEFAULT_TARGET_LANG", "English")

    debug: bool = _as_bool(os.getenv("CT_DEBUG", "false"))
    debug_dir: Path = field(
        default_factory=lambda: Path(os.getenv("CT_DEBUG_DIR", "./debug_out"))
    )


CONFIG = Config()
