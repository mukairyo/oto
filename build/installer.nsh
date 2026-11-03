; Oto installer, branded welcome and finish pages.
!macro customHeader
  !define MUI_FINISHPAGE_TITLE "Oto is ready"
  !define MUI_FINISHPAGE_TEXT "Oto has been installed on your PC.$\r$\n$\r$\nWhen it opens, a short setup lets you choose your layout, colours, speed and privacy, it takes about two minutes."
  !define MUI_FINISHPAGE_RUN_TEXT "Open Oto now"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Oto"
  !define MUI_WELCOMEPAGE_TEXT "A calm browser for Windows with vertical tabs, spaces in your own colours, and built-in ad blocking.$\r$\n$\r$\nThis will install Oto on your PC. Click Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Registers Oto as a web browser so it appears in Windows Settings > Default apps.
!macro customInstall
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
