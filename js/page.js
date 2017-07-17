function d2h(d) {
    return d.toString(16)
}

function h2d(h) {
    return parseInt(h, 16)
}

function stringToHex(tmp) {
    var str = '',
        i = 0,
        tmp_len = tmp.length,
        c

    for (; i < tmp_len; i += 1) {
        c = tmp.charCodeAt(i)
        str += d2h(c) + ' '
    }
    return str
}

function hexToString(tmp) {
    var arr = tmp.split(' '),
        str = '',
        i = 0,
        arr_len = arr.length,
        c

    for (; i < arr_len; i += 1) {
        c = String.fromCharCode(h2d(arr[i]))
        str += c
    }

    return str
}



marked.setOptions({
    "gfm": true,
    "breaks": true,
    "sanitize": true,
    "smartLists": true,
    "smartypants": true,
    "highlight": function(code) {

        // console.log("Highlighting >> ", code)
        return hljs.highlightAuto(code).value
    }
})

var markedR = new marked.Renderer()
markedR.table = function(header, body) {
    return '<table class="table table-striped">\n' +
        '<thead>\n' +
        header +
        '</thead>\n' +
        '<tbody>\n' +
        body +
        '</tbody>\n' +
        '</table>\n'
}
markedR.link = function(href, title, text) {
    var href = href || '',
        title = title || '',
        text = text || ''

    if (this.options.sanitize) {
        try {
            var prot = decodeURIComponent(unescape(href))
                .replace(/[^\w:]/g, '')
                .toLowerCase()
        } catch (e) {
            return ''
        }
        if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
            return ''
        }
    }

    return '<a href="' + href + '" onclick="return openNewTab(\'' + href + '\');" ' + (title ? ('title="' + title + '"') : '') + '>' + text + '</a>'
}

function openNewTab(url) {
    page.cmd("wrapperOpenWindow", [url, "_blank", ""])
    return false
}



class ThunderNote extends ZeroFrame {
    getAvatar(username, cb) {
        function avatarGen() {
            page.identicons = page.identicons || {}
            var asv = 64
            if (!page.identicons.hasOwnProperty(asv)) {
                page.identicons[asv] = {}
            }
            if (!page.identicons.hasOwnProperty(username)) {
                var uhash = stringToHex(username).split(' ').join('')
                page.identicons[asv][username] = new Identicon(uhash, {
                    margin: 0.2,
                    size: asv,
                    format: 'svg'
                }).toString()
            }
            var idata = page.identicons[asv][username]

            var avatar_pic = (typeof idata !== "undefined" ? "<img src='data:image/svg+xml;base64," + idata + "' />" : "")
            return avatar_pic
        }

        cb(avatarGen())
    }

    selectUser() {
        this.cmd("certSelect", {
            accepted_domains: [
                "zeroid.bit",
                "zeroverse.bit",
                "kaffie.bit"
            ]
        })
        return false
    }
    onRequest(cmd, message) {
        //  console.log("COMMAND", cmd, message)
        if (cmd == "setSiteInfo") {
            this.site_info = message.params // Save site info data to allow access it later
            this.setSiteInfo(message.params)

            if (message.params.cert_user_id) {
                $('.hideifnotloggedin').removeClass("hide")
                $("#select_user").html("Change user")
                $('#current_user_name').html(message.params.cert_user_id)

                page.getAvatar(message.params.cert_user_id, (img) => {
                    $('#current_user_avatar').html('<figure class="avatar" data-initial="' + message.params.cert_user_id.substr(0, 2) + '" onclick="">' + img + '</figure>')
                })

                if (message.params.event[0] === "cert_changed" && message.params.event[1]) {
                    // this.loadMessages("cert changed")
                }
            } else {
                $('.hideifnotloggedin').addClass("hide")
                $("#select_user").html("Select user")
                $('#current_user_name').html("Please login first")
                $('#current_user_avatar').html('<figure class="avatar" data-initial="TW"></figure>')
            }

            if (message.params.event[0] == "file_done") {
                // this.loadMessages("file done", false, true)
            }
        }
    }

    setSiteInfo(site_info) {
        var dis = this
        $("#out").html(
            "Page address: " + site_info.address +
            "<br>- Peers: " + site_info.peers +
            "<br>- Size: " + site_info.settings.size +
            "<br>- Modified: " + (new Date(site_info.content.modified * 1000))
        )
    }


    verifyUserFiles(cb1, cb2) {
        var data_inner_path = "data/users/" + this.site_info.auth_address + "/data.json"
        var data2_inner_path = "data/users/" + this.site_info.auth_address + "/data_private.json"
        var content_inner_path = "data/users/" + this.site_info.auth_address + "/content.json"

        var curpversion = 0

        function verifyData2() {
            page.cmd("fileGet", {
                "inner_path": data2_inner_path,
                "required": false
            }, (data) => {
                // console.log("BEFORE 1", data)
                if (data)
                    var data = JSON.parse(data)
                else
                    var data = {}
                var olddata = JSON.parse(JSON.stringify(data))
                console.log("BEFORE 2", olddata)

                if (data.pversion !== curpversion)
                    data = {
                        "pversion": curpversion
                    }

                if (!data.hasOwnProperty("private_notes"))
                    data.private_notes = []

                console.log("VERIFIED data_private.json", olddata, data)
            })
        }

        function verifyData(cb1, cb2) {
            page.cmd("fileGet", {
                "inner_path": data_inner_path,
                "required": false
            }, (data) => {
                if (data)
                    var data = JSON.parse(data)
                else
                    var data = {}
                var olddata = JSON.parse(JSON.stringify(data))

                if (data.pversion !== curpversion) {
                    data.pversion = curpversion
                    data.private_notes = []
                }

                if (!data.hasOwnProperty("private_notes"))
                    data.private_notes = []

                if (!data.hasOwnProperty("extra_data") || !data.extra_data[0])
                    data.extra_data = [{}]
                if (!data.extra_data[0].hasOwnProperty("public_key") || !data.extra_data[0].public_key) {
                    page.cmd("userPublickey", [], (public_key) => {
                        data.extra_data[0].public_key = public_key
                        verifyData_2(data, olddata, cb1, cb2)
                    })
                } else {
                    verifyData_2(data, olddata, cb1, cb2)
                }
            })
        }

        function verifyData_2(data, olddata, cb1, cb2) {
            console.log("VERIFIED data.json", olddata, data)

            var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')))
            var json_rawA = btoa(json_raw)

            if (JSON.stringify(data) !== JSON.stringify(olddata)) {
                console.log("data.json HAS RECEIVED A UPDATE!")
                page.cmd("fileWrite", [
                    data_inner_path,
                    json_rawA
                ], (res) => {
                    if (res == "ok") {
                        console.log("data.json HAS BEEN UPDATED!")

                        if (typeof cb1 === "function")
                            cb1(data, olddata)
                        verifyContent(data, olddata, cb2)
                    } else {
                        page.cmd("wrapperNotification", [
                            "error", "File write error: " + JSON.stringify(res)
                        ])
                    }
                })
            } else
                verifyContent(data, olddata, cb2)
        }

        function verifyContent(data, olddata, cb2) {
            page.cmd("fileGet", {
                "inner_path": content_inner_path,
                "required": false
            }, (data2) => {
                if (data2)
                    var data2 = JSON.parse(data2)
                else
                    var data2 = {}
                var olddata2 = JSON.parse(JSON.stringify(data2))

                var curoptional = "" // ".+\\.(png|jpg|jpeg|gif|mp3|ogg)"
                var curignore = "" // "(?!(.+\\.(png|jpg|jpeg|gif|mp3|ogg)|data.json))"
                if (!data2.hasOwnProperty("optional") || data2.optional !== curoptional)
                    data2.optional = curoptional
                if (!data2.hasOwnProperty("ignore") || data2.ignore !== curignore)
                    data2.ignore = curignore
                console.log("VERIFIED content.json", olddata2, data2)

                var json_raw2 = unescape(encodeURIComponent(JSON.stringify(data2, undefined, '\t')))
                var json_rawA2 = btoa(json_raw2)

                if (JSON.stringify(data2) !== JSON.stringify(olddata2) || JSON.stringify(data) !== JSON.stringify(olddata)) {
                    console.log("content.json HAS RECEIVED A UPDATE!")
                    page.cmd("fileWrite", [
                        content_inner_path,
                        json_rawA2
                    ], (res) => {
                        if (res == "ok") {
                            console.log("content.json HAS BEEN UPDATED!")
                            if (typeof cb2 === "function")
                                cb2(data2, olddata2)
                            page.cmd("siteSign", {
                                "inner_path": content_inner_path
                            }, (res) => {
                                page.cmd("sitePublish", {
                                    "inner_path": content_inner_path,
                                    "sign": false
                                }, function() {
                                    // console.log(data.messages, data.messages.length)
                                    if (data.messages.length === 1)
                                        page.cmd("wrapperNotification", [
                                            "done", "Your first message was sent successfully! :)"
                                        ])
                                })
                            })
                        } else {
                            page.cmd("wrapperNotification", [
                                "error", "File write error: " + JSON.stringify(res)
                            ])
                        }
                    })
                }
            })
        }
        verifyData(cb1, cb2)

        verifyData2()
    }

    verifyUser() {
        var rtrn = true

        if (!this.site_info.cert_user_id) {
            rtrn = false
            this.cmd("wrapperNotification", [
                "info", "Please, select your account.", 5000
            ])
            this.selectUser()
        }
        return rtrn
    }

    onOpenWebsocket() {
        this.cmd("siteInfo", {}, (site_info) => {
            this.site_info = site_info
            this.setSiteInfo(site_info)
            if (site_info.cert_user_id) {
                // $("#select_user").text(site_info.cert_user_id)

                this.verifyUserFiles()
            }
        })

        console.log("Ready to call ZeroFrame API!")
    }
}
page = new ThunderNote();