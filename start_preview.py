"""Start the user's local app; close with Ctrl+C. No cloud connection needed."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent / 'dist'
url = 'http://127.0.0.1:4175/training.html'
try:
    server = ThreadingHTTPServer(('127.0.0.1', 4175), partial(SimpleHTTPRequestHandler, directory=str(root)))
except OSError as error:
    print(f'无法启动本地服务：{error}')
    print('如果已有本 app 的窗口在运行，请使用它；否则关闭占用 4175 端口的程序后重试。')
    raise SystemExit(1)

print(f'JS Practice 已在本机启动：{url}')
print('请保留此终端窗口。按 Ctrl+C 可以停止。')
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    print('\nJS Practice 本地服务已停止。浏览器保存的学习记录不会因此删除。')
finally:
    server.server_close()
