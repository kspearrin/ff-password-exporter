const electron = require('electron');
const fs = require('fs');
const path = require('path');
const SQL = require('sql.js');
const forge = require('node-forge');
const Papa = require('papaparse');
const iconv = require('iconv-lite');

(() => {
    const paths = getDefaultProfileDirectories();
    const profiles = document.querySelector('#profiles');
    let setSelected = false;
    for (const p of paths) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.text = p;
        if (!setSelected) {
            setSelected = true;
            opt.selected = true;
        }
        profiles.appendChild(opt);
    }

    if (setSelected) {
        document.querySelector('#profile-path').innerHTML = paths[0];
    }

    profiles.addEventListener('change', () => {
        document.querySelector('#profile-path').innerHTML = document.querySelector('#profiles').value;
    });

    const directoryPicker = document.querySelector('#directory-picker');
    const chooseProfile = document.querySelector('#choose-profile');
    chooseProfile.addEventListener('click', () => {
        directoryPicker.click();
    });

    directoryPicker.addEventListener('change', () => {
        const picker = document.querySelector('#directory-picker');
        if (picker.files && picker.files.length) {
            document.querySelector('#profile-path').innerHTML = picker.files[0].path;
            document.querySelector('#profiles').children[0].selected = true;
        }
    });

    document.querySelector('#bitwarden').addEventListener('click', () => {
        electron.shell.openExternal('https://bitwarden.com/?ref=ff-password-exporter');
    });

    const exportBtn = document.querySelector('#export');
    exportBtn.addEventListener('click', async () => {
        let profileDirectory = document.querySelector('#profile-path').innerHTML;
        if (profileDirectory == null || profileDirectory === '') {
            showAlert('error', 'You must select a profile directory.');
            return;
        }
        try {
            const logins = getLogins(profileDirectory, document.querySelector('#master-password').value);
            electron.remote.dialog.showSaveDialog({
                defaultPath: makeFileName(),
                filters: [
                    { name: 'CSV', extensions: ['csv'] },
                    { name: 'JSON', extensions: ['json'] }
                ]
            }, (filename) => {
                const data = path.extname(filename) === '.json' ? JSON.stringify(logins) : Papa.unparse(logins);
                fs.writeFile(filename, data, 'utf-8', (e) => {
                    if (e) {
                        showAlert('error', e);
                    }
                });
            });
        } catch (e) {
            showAlert('error', e);
        }
    });

    function showAlert(type, message) {
        electron.remote.dialog.showMessageBox(electron.remote.getCurrentWindow(), {
            type: type,
            detail: message.toString(),
            buttons: ['Ok'],
            noLink: true
        });
    }

    function getDefaultProfileDirectories() {
        let defaultProfilePaths = [];
        const appData = electron.remote.app.getPath('appData');
        if (process.platform === 'win32') {
            defaultProfilePaths.push(path.join(appData, 'Mozilla/Firefox/Profiles'));
        } else if (process.platform === 'darwin') {
            defaultProfilePaths.push(path.join(appData, 'Firefox/Profiles'));
            defaultProfilePaths.push(path.join(appData, '../Mozilla/Firefox/Profiles'));
        } else if (process.platform === 'linux') {
            defaultProfilePaths.push(path.join(appData, '../.mozilla/firefox'));
        }

        let profiles = [];
        for (const p of defaultProfilePaths) {
            if (!fs.existsSync(p)) {
                continue;
            }
            const directories = fs.readdirSync(p).map(name => path.join(p, name))
                .filter((s) => {
                    return fs.lstatSync(s).isDirectory() && s.indexOf('Crash Reports') === -1 &&
                        s.indexOf('Pending Pings') === -1;
                });
            if (directories.length) {
                profiles = profiles.concat(directories);
            }
        }

        return profiles;
    }

    function makeFileName() {
        const now = new Date();
        const dateString =
            now.getFullYear() + '' + padNumber(now.getMonth() + 1, 2) + '' + padNumber(now.getDate(), 2) +
            padNumber(now.getHours(), 2) + '' + padNumber(now.getMinutes(), 2) +
            padNumber(now.getSeconds(), 2);

        return 'firefox_logins_' + dateString;
    }

    function padNumber(num, width, padCharacter) {
        padCharacter = padCharacter || '0';
        const numString = num.toString();
        return numString.length >= width ? numString :
            new Array(width - numString.length + 1).join(padCharacter) + numString;
    }

    function getLogins(profileDirectory, masterPassword) {
        const key = getKey(profileDirectory, masterPassword);
        if (key == null) {
            throw new Error('No key found.');
        }

        const loginsFilePath = path.join(profileDirectory, 'logins.json');
        if (!fs.existsSync(loginsFilePath)) {
            throw new Error('logins.json was not found in this profile directory.');
        }

        const logins = [];
        const loginsData = fs.readFileSync(loginsFilePath, 'utf8');
        const profileLogins = JSON.parse(loginsData);
        for (const login of profileLogins.logins) {
            const decodedUsername = decodeLoginData(login.encryptedUsername);
            const decodedPassword = decodeLoginData(login.encryptedPassword);
            const username = decrypt(decodedUsername.data, decodedUsername.iv, key, '3DES-CBC');
            const password = decrypt(decodedPassword.data, decodedPassword.iv, key, '3DES-CBC');

            let encodeUsername = iconv.encode(username.data, 'latin1').toString();
            if (encodeUsername != username.data) {
                username.data = encodeUsername;
            }

            let encodePassword = iconv.encode(password.data, 'latin1').toString();
            if (encodePassword != password.data) {
                password.data = encodePassword;
            }

            logins.push({
                hostname: login.hostname,
                username: username.data,
                password: password.data,
                timeCreated: login.timeCreated,
                timeLastUsed: login.timeLastUsed,
                timePasswordChanged: login.timePasswordChanged,
                timesUsed: login.timesUsed,
            });
        }

        return logins;
    }

    function decodeLoginData(b64) {
        const asn1 = forge.asn1.fromDer(forge.util.decode64(b64));
        return {
            iv: asn1.value[1].value[1].value,
            data: asn1.value[2].value
        };
    }

    function getKey(profileDirectory, masterPassword) {
        const key4FilePath = path.join(profileDirectory, 'key4.db');
        if (!fs.existsSync(key4FilePath)) {
            throw new Error('key4.db was not found in this profile directory.');
        }

        const masterPasswordBytes = forge.util.encodeUtf8(masterPassword || '');
        const key4File = fs.readFileSync(key4FilePath);
        const key4Db = new SQL.Database(key4File);
        const metaData = key4Db.exec('SELECT item1, item2 FROM metadata WHERE id = \'password\';');
        if (metaData && metaData.length && metaData[0].values && metaData[0].values.length) {
            const globalSalt = toByteString(metaData[0].values[0][0].buffer);
            const item2 = toByteString(metaData[0].values[0][1].buffer);
            const item2Asn1 = forge.asn1.fromDer(item2);
            const item2Value = pbesDecrypt(item2Asn1.value, masterPasswordBytes, globalSalt);
            if (item2Value && item2Value.data === 'password-check') {
                const nssData = key4Db.exec('SELECT a11 FROM nssPrivate WHERE a11 IS NOT NULL;');
                if (nssData && nssData.length && nssData[0].values && nssData[0].values.length) {
                    const a11 = toByteString(nssData[0].values[0][0].buffer);
                    const a11Asn1 = forge.asn1.fromDer(a11);
                    return pbesDecrypt(a11Asn1.value, masterPasswordBytes, globalSalt);
                }
            } else {
                // TODO: Support key3.db?
                throw new Error('Master password incorrect.');
            }
        }

        throw new Error('Not able to get key from profile directory or no passwords were found.');
    }

    function pbesDecrypt(decodedItemSeq, password, globalSalt) {
        // forge.asn1.fromDer() doesn't seem to decode OBJECTIDENTIFIER values properly,
        // so we determine if we're using PBES or PBES2 by structure.
        if (decodedItemSeq[0].value[1].value[0].value[1].value != null) {
            return pbes2Decrypt(decodedItemSeq, password, globalSalt);
        }
        return pbes1Decrypt(decodedItemSeq, password, globalSalt);
    }

    function pbes1Decrypt(decodedItemSeq, password, globalSalt) {
        const data = decodedItemSeq[1].value;
        const salt = decodedItemSeq[0].value[1].value[0].value;
        const hp = sha1(globalSalt + password);
        const pes = toByteString(pad(toArray(salt), 20).buffer);
        const chp = sha1(hp + salt);
        const k1 = hmac(pes + salt, chp);
        const tk = hmac(pes, chp);
        const k2 = hmac(tk + salt, chp);
        const k = k1 + k2;
        const kBuffer = forge.util.createBuffer(k);
        const otherLength = kBuffer.length() - 32;
        const key = kBuffer.getBytes(24);
        kBuffer.getBytes(otherLength);
        const iv = kBuffer.getBytes(8);
        return decrypt(data, iv, key, '3DES-CBC');
    }

    // Adapted from https://github.com/lclevy/firepwd/blob/master/firepwd.py
    function pbes2Decrypt(decodedItemSeq, password, globalSalt) {
        const data = decodedItemSeq[1].value;
        const pbkdf2Seq = decodedItemSeq[0].value[1].value[0].value[1].value;
        const salt = pbkdf2Seq[0].value;
        const iterations = pbkdf2Seq[1].value.charCodeAt();
        // Prepending 0x040e, where 0x04 = octetstring, 0x0e = string length (14)
        const iv = '' + decodedItemSeq[0].value[1].value[1].value[1].value;
        const k = sha1(globalSalt + password);
        const key = forge.pkcs5.pbkdf2(k, salt, iterations, 32, forge.md.sha256.create());
        return decrypt(data, iv, key, 'AES-CBC');
    }

    function decrypt(data, iv, key, algorithm) {
        const decipher = forge.cipher.createDecipher(algorithm, key);
        decipher.start({ iv: iv });
        decipher.update(forge.util.createBuffer(data));
        decipher.finish();
        return decipher.output;
    }

    function sha1(data) {
        const md = forge.md.sha1.create();
        md.update(data, 'raw');
        return md.digest().data;
    }

    function pad(arr, length) {
        if (arr.length >= length) {
            return arr;
        }
        const padAmount = length - arr.length;
        const padArr = [];
        for (let i = 0; i < padAmount; i++) {
            padArr.push(0);
        }

        var newArr = new Uint8Array(padArr.length + arr.length);
        newArr.set(padArr, 0);
        newArr.set(arr, padArr.length);
        return newArr;
    }

    function hmac(data, key) {
        const hmac = forge.hmac.create();
        hmac.start('sha1', key);
        hmac.update(data, 'raw');
        return hmac.digest().data;
    }

    function toByteString(buffer) {
        return String.fromCharCode.apply(null, new Uint8Array(buffer));
    }

    function toArray(str) {
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            arr[i] = str.charCodeAt(i);
        }
        return arr;
    }
})();
