# FF Password Exporter

It can be difficult to export your passwords from Firefox. Since version 57 of Firefox (Quantum) existing password export addons  no longer work. Mozilla provides no other official alternatives. FF Password Exporter makes it quick and easy to export all of your passwords from Firefox. You can use FF Password Exporter on Windows, macOS, and Linux distributions.

![FF Password Exporter](http://imgur.com/xjPNUOJ.png "FF Password Exporter")

## Download/Install

- Windows 7, 8, 10 and later
  - [Portable (.exe, x86 and x64)](https://github.com/kspearrin/ff-password-exporter/releases/download/v1.2.0/FF-Password-Exporter-Portable-1.2.0.exe)
  - [Installer (.exe, x86 and x64)](https://github.com/kspearrin/ff-password-exporter/releases/download/v1.2.0/FF-Password-Exporter-Installer-1.2.0.exe)
- macOS (OS X) Mavericks and later 
  - [Portable (.app, x64)](https://github.com/kspearrin/ff-password-exporter/releases/download/v1.2.0/ff-password-exporter-1.2.0-mac.zip)
  - [Installer (.dmg, x64)](https://github.com/kspearrin/ff-password-exporter/releases/download/v1.2.0/FF-Password-Exporter-1.2.0.dmg)
- Linux
  - [Portable (.AppImage, x64)](https://github.com/kspearrin/ff-password-exporter/releases/download/v1.2.0/FF-Password-Exporter-1.2.0-x86_64.AppImage)

## How to Use

1. Download and install/run FF Password Exporter. Use the links above.
2. Choose the Firefox user's profile directory you want to export passwords from.
3. If you have set a master password to protect your Firefox passwords, enter it.
4. Click the export button.
5. Choose your file format (CSV or JSON), and save the file to your device.

## Supported Firefox Versions

- Firefox 58+ with `key4.db` profiles

## Contributing

FF Password Exporter is written in Electron with JavaScript. Contributions/pull requests are welcome!

**Requirements**

- [Node.js](https://nodejs.org/)

**Run the app**

```bash
npm install
npm run electron
```
