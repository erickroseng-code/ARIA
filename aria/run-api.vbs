Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\erick\Projects\aios-core\aria\apps\api"
shell.Run "node ""C:\Users\erick\Projects\aios-core\aria\node_modules\tsx\dist\cli.mjs"" src\server.ts", 0, True
