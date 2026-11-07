; Oto installer, branded in the Oto theme: near-black pages, cream text, the vortex artwork.
!macro customHeader
  ; show the friendly version (e.g. 0.9.8.1) instead of the updater's number (0.9.801)
  BrandingText "Oto $%OTO_VERSION%"
!macroend

; welcome, finish and the page headers are dark (set before the first page is added)
!macro otoColors
  !define /ifndef MUI_BGCOLOR "0B0B0C"
  !define /ifndef MUI_TEXTCOLOR "ECE8E1"
!macroend

!macro customWelcomePage
  !insertmacro otoColors
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Oto"
  !define MUI_WELCOMEPAGE_TEXT "A calm browser for Windows: vertical tabs, spaces, built-in ad blocking, and your phone linked to your PC.$\r$\n$\r$\nClick Next to install Oto."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Our own finish page (electron-builder's adds its texts too late, so they never showed).
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Oto is ready"
  !define MUI_FINISHPAGE_TEXT "Oto is installed on your PC.$\r$\n$\r$\nWhen it opens, a short setup lets you pick your layout, speed and privacy. It takes about two minutes."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Open Oto now"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW otoFinishShow
  !insertmacro MUI_PAGE_FINISH
  ; (after the page: it declares $mui.FinishPage.Run)
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd
  Function otoFinishShow
    ; themed checkboxes ignore text colours: draw this one classic so it's readable on dark
    System::Call 'uxtheme::SetWindowTheme(p $mui.FinishPage.Run, w " ", w " ")'
    SetCtlColors $mui.FinishPage.Run "ECE8E1" "0B0B0C"
  FunctionEnd
!macroend

!macro customUnWelcomePage
  !insertmacro otoColors
  !define MUI_WELCOMEPAGE_TITLE "Remove Oto"
  !define MUI_WELCOMEPAGE_TEXT "This removes Oto from your PC. Your bookmarks and settings stay saved in your Oto account if you're signed in.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

; Registers Oto as a web browser so it appears in Windows Settings > Default apps.
!macro customInstall
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion" "$%OTO_VERSION%"
  ; A fresh install (not an auto-update) leaves a marker, so Oto opens the welcome setup once.
  ${ifNot} ${isUpdated}
    System::Call 'kernel32::GetTickCount()i.r1'
    FileOpen $0 "$INSTDIR\resources\fresh-install.txt" w
    FileWrite $0 "$1"
    FileClose $0
  ${endIf}
  WriteRegStr HKCU "Software\Classes\OtoURL" "" "Oto Web Document"
  WriteRegStr HKCU "Software\Classes\OtoURL" "FriendlyTypeName" "Oto Web Document"
  WriteRegStr HKCU "Software\Classes\OtoURL\DefaultIcon" "" "$INSTDIR\Oto.exe,0"
  WriteRegStr HKCU "Software\Classes\OtoURL\shell\open\command" "" '"$INSTDIR\Oto.exe" "%1"'

  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto" "" "Oto"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\DefaultIcon" "" "$INSTDIR\Oto.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\shell\open\command" "" '"$INSTDIR\Oto.exe"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities" "ApplicationName" "Oto"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities" "ApplicationDescription" "A calm, minimal browser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities" "ApplicationIcon" "$INSTDIR\Oto.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities\URLAssociations" "http" "OtoURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities\URLAssociations" "https" "OtoURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities\FileAssociations" ".htm" "OtoURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities\FileAssociations" ".html" "OtoURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities\FileAssociations" ".pdf" "OtoURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Oto\Capabilities\StartMenu" "StartMenuInternet" "Oto"
  WriteRegStr HKCU "Software\RegisteredApplications" "Oto" "Software\Clients\StartMenuInternet\Oto\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\OtoURL"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Oto"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Oto"
!macroend

; Test builds only (OTO_TEST=1): skip the "is Oto running?" check, which Wine gets wrong.
!if "$%OTO_TEST%" == "1"
!macro customCheckAppRunning
!macroend
!endif
