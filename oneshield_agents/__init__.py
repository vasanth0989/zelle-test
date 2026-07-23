"""One Shield agents — portable LangGraph orchestrator for NeuroSecure.

cof edition: every LLM call goes through the sandbox client
(create_chat_openai_model, llama-4-scout). Wired into backend/app.py, or
standalone in a notebook via notebook.run_scenario.
"""
from .agent import compile_agent, run_investigation
from .notebook import arun_scenario, run_scenario

__all__ = ["compile_agent", "run_investigation", "arun_scenario", "run_scenario"]
