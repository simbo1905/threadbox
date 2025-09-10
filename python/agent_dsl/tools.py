"""
Default tools for agent-dsl Python runtime

Provides mock implementations of common tools
"""

import subprocess
import json
import time
from typing import Any, Dict, Optional
from rx import Observable
import requests


class ToolRegistry:
    """Registry for tool functions"""
    
    def __init__(self):
        self._tools: Dict[str, callable] = {}
        self._register_default_tools()
    
    def register(self, name: str, tool_fn: callable):
        """Register a tool function"""
        self._tools[name] = tool_fn
    
    def get(self, name: str) -> Optional[callable]:
        """Get a tool function by name"""
        return self._tools.get(name)
    
    def list_tools(self) -> list[str]:
        """List all registered tool names"""
        return list(self._tools.keys())
    
    def _register_default_tools(self):
        """Register default tool implementations"""
        
        def call_api(input_data: Any, config: Dict[str, Any]) -> Observable:
            """HTTP API call tool"""
            def _call():
                url = config.get('url', '')
                method = config.get('method', 'POST').upper()
                headers = config.get('headers', {})
                timeout_ms = config.get('timeout', 5000)
                
                try:
                    # Mock implementation - replace with real HTTP call
                    time.sleep(0.1)  # Simulate network delay
                    response_data = {
                        'status': 200,
                        'data': {'message': f'Mock response from {url}', 'input': input_data},
                        'url': url,
                        'method': method
                    }
                    return response_data
                except Exception as e:
                    raise Exception(f'API call failed: {str(e)}')
            
            return Observable.from_callable(_call)
        
        def run_shell(input_data: Any, config: Dict[str, Any]) -> Observable:
            """Shell command execution tool"""
            def _run():
                command = config.get('command', '')
                cwd = config.get('cwd')
                env = config.get('env')
                timeout_ms = config.get('timeout', 10000)
                
                try:
                    # Mock implementation - replace with real subprocess call
                    time.sleep(0.05)  # Simulate execution time
                    result = {
                        'stdout': f'Mock output from: {command}',
                        'stderr': '',
                        'exit_code': 0,
                        'command': command,
                        'cwd': cwd
                    }
                    return result
                except Exception as e:
                    raise Exception(f'Shell command failed: {str(e)}')
            
            return Observable.from_callable(_run)
        
        def use_mcp(input_data: Any, config: Dict[str, Any]) -> Observable:
            """Model Context Protocol tool"""
            def _mcp():
                service = config.get('service', '')
                method = config.get('method', '')
                params = config.get('params', {})
                
                try:
                    # Mock MCP implementation
                    time.sleep(0.1)
                    result = {
                        'result': f'Mock MCP result from {service}.{method}',
                        'service': service,
                        'method': method,
                        'params': params,
                        'input': input_data
                    }
                    return result
                except Exception as e:
                    raise Exception(f'MCP call failed: {str(e)}')
            
            return Observable.from_callable(_mcp)
        
        def read_file(input_data: Any, config: Dict[str, Any]) -> Observable:
            """File reading tool"""
            def _read():
                path = config.get('path', '')
                encoding = config.get('encoding', 'utf8')
                max_size = config.get('max_size')
                
                try:
                    # Mock file read
                    content = f'Mock file content from {path}'
                    result = {
                        'content': content,
                        'path': path,
                        'encoding': encoding,
                        'size': len(content)
                    }
                    return result
                except Exception as e:
                    raise Exception(f'File read failed: {str(e)}')
            
            return Observable.from_callable(_read)
        
        def write_file(input_data: Any, config: Dict[str, Any]) -> Observable:
            """File writing tool"""
            def _write():
                path = config.get('path', '')
                encoding = config.get('encoding', 'utf8')
                create_dirs = config.get('create_dirs', False)
                
                try:
                    # Mock file write
                    content = str(input_data) if input_data is not None else ''
                    result = {
                        'success': True,
                        'path': path,
                        'encoding': encoding,
                        'bytes_written': len(content.encode(encoding))
                    }
                    return result
                except Exception as e:
                    raise Exception(f'File write failed: {str(e)}')
            
            return Observable.from_callable(_write)
        
        # Register all default tools
        self.register('callApi', call_api)
        self.register('runShell', run_shell)
        self.register('useMCP', use_mcp)
        self.register('readFile', read_file)
        self.register('writeFile', write_file)


# Global tool registry instance
default_tools = ToolRegistry()