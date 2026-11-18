
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from backend/.env
ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE)

# PostgreSQL connection URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./sentra.db"
)

# Configure the engine based on the database type
connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

# Database session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for SQLAlchemy models
Base = declarative_base()
