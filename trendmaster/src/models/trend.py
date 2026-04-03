import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Trend(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source: str
    content_hash: str = Field(index=True, unique=True)
    title: str
    content: str
    url: str
    published_at: datetime.datetime
    engagement: float = Field(default=0.0)
    viral_score: float = Field(default=0.0)
    processed_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
