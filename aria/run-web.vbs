Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\erick\Projects\aios-core\aria\apps\web"
shell.Run "node ""C:\Users\erick\Projects\aios-core\aria\node_modules\next\dist\bin\next"" dev -p 3000 --turbopack", 0, True
