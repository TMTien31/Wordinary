from __future__ import annotations

from typing import Annotated

from pydantic import AwareDatetime, Field

ProgressPercent = Annotated[float, Field(ge=0, le=100)]
NonNegativeSeconds = Annotated[float, Field(ge=0)]
LanguageCode = Annotated[
    str,
    Field(min_length=2, max_length=20, pattern=r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$"),
]
UtcDateTime = AwareDatetime
LegacyEpochMilliseconds = Annotated[int, Field(ge=0)]
