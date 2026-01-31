; Remove startup entries when the user uninstalls Salaat Widget.
; Electron uses the Registry Run key (not the Startup folder), so we remove both.
!macro customUnInstall
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Salaat Widget.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Electron.lnk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Salaat Widget"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Electron"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Salaat"
!macroend
