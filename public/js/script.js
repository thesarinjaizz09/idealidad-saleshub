
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const authToken = urlParams.get("authToken");
var socket = io.connect("http://localhost:1337");
socket.on("connect", () => {
    socket.emit(
        "get_user",
        {
            authToken: authToken,
            fromInstance: true,
            password: "spfudFojOQJsh7FmhAKSJDBHVKSDBVad55gegy.saleshub.io",
        },
        (err) => {
            if (err) {
                alert(err);
                // myFunction(err);
            }
        }
    );
});

socket.on("got_user", ({ user, password }) => {
    if (password === "spfudFojOQJsh7Fmhad5JHVCASDKy.saleshub.io") {
        if (user._wpIntegration && user._wpSessionData !== "") {
            socket.emit("authenticate_whatsapp", { authToken, password: "spfudFojOQJsh7FmhAKSJDBHVKSDBVad55gegy.saleshub.io" }, (err) => {
                if (err) {
                    alert(err)
                }
            })
        }
    }
});