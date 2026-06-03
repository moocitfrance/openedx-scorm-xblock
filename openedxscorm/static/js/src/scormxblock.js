function ScormXBlock(runtime, element, settings) {

    // Fullscreen
    function initFullscreen() {
        const xblock = $(element).find(".scorm-xblock").get(0);
        // React to button clicks
        $(element).find("button.enter-fullscreen").on("click", function () {
            requestFullscreen(xblock);
        });
        $(element).find("button.exit-fullscreen").on("click", function () {
            exitFullscreen();
        });

        // React to ESC key
        // We are relying on older event names for backward compatibility
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event
        if (xblock.addEventListener) {
            const fullscreenChangeEvents = ['fullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange', 'webkitfullscreenchange'];
            fullscreenChangeEvents.forEach(function (eventName) {
                xblock.addEventListener(eventName, onFullscreenChange, false);
            });
        }
    }
    function requestFullscreen(elt) {
        if (elt.requestFullscreen) {
            elt.requestFullscreen();
        } else if (elt.mozRequestFullScreen) {
            elt.mozRequestFullScreen();
        } else if (elt.webkitRequestFullscreen) {
            elt.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (elt.msRequestFullscreen) {
            elt.msRequestFullscreen();
        }
    }
    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    function isFullscreen() {
        return Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }
    function onFullscreenChange(e) {
        if (isFullscreen()) {
            $(e.target).addClass("fullscreen-enabled");
            if (settings.block_height > screen.height) {
                $(e.target).css("height", screen.height);
            }
            // Override height and cover entire display in fullscreen
            $(e.target).find(".scorm-panel").css("height", "100%");
            $(e.target).find(".scorm-pane").css("height", "100%");
        } else {
            $(e.target).removeClass("fullscreen-enabled");
            // Revert back to custom height on fullscreen exit
            $(e.target).removeAttr("style");
            $(e.target).find(".scorm-panel").removeAttr("style");
            $(e.target).find(".scorm-pane").css("height", settings.block_height);
        }
        // This is required to trigger the actual content resize in some packages
        window.dispatchEvent(new Event('resize'));
}

    // Popup window
    function initPopupWindow() {
        if (!settings.popup_on_launch) {
            return;
        }
        var popupWindowName = "openedx-scorm-xblock";
        $(element).find(".scorm-xblock").addClass("can-popup");
        $(element).find(".scorm-xblock .popup-launcher").on("click", function (event) {
            var windowSpecs = "width=" + settings.popup_width + ",height=" + settings.popup_height;
            windowSpecs += "menubar=no,tollbar=no";
            var popupWindow = window.open(
                runtime.handlerUrl(element, 'popup_window'),
                popupWindowName, specs = windowSpecs
            );
            // Copy scorm API objects: scorm API calls will be redirected to this window
            popupWindow.API = window.API;
            popupWindow.API_1484_11 = window.API_1484_11;
            // Close popup when main window is closed
            // https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
            window.addEventListener('beforeunload', function (e) {
                if (!popupWindow.closed) {
                    // We don't prompt user for confirmation
                    popupWindow.close();
                    e.returnValue = '';
                }
            });
        });
    }

    // Student reports
    var reportElement = $(element).find(".scorm-reports .report");
    function initReports() {
        if (reportElement.length === 0){
            return;
        }
        $(element).find("button.view-reports").on("click", function () {
            viewReports();
        });
        $(element).find("button.reload-report").on("click", function () {
            reloadReport();
        });
        // https://api.jqueryui.com/autocomplete/
        // note that we don't use $(...).autocomplete({}). That's because the lms has an obsolete
        // autocomplete jquery plugin which overrides the jquery.ui.autocomplete widget.
        // So we need to specify the widget namespace when we call "autocomplete"
        $.ui.autocomplete(
            {
                source: searchStudents,
                select: viewReport,
            }, $(element).find(".scorm-reports input.search-students")
        );
    }
    function searchStudents(request, response) {
        $.ajax({
            url: runtime.handlerUrl(element, 'scorm_search_students'),
            data: {
                'id': request.term
            },
        }).success(function (data) {
            if (data.length === 0) {
                noStudentFound()
            }
            response(data);
        }).fail(function () {
            noStudentFound()
            response([])
        });
    }
    function noStudentFound() {
        reportElement.html("no student found");
        $(element).find(".reload-report").addClass("reports-togglable-off");
    }
    function viewReports() {
        // Display reports on button click
        $(element).find(".reports-togglable").toggleClass("reports-togglable-off");
    }
    var studentId = null;
    function viewReport(event, ui) {
        studentId = ui.item.data.student_id;
        getReport(studentId);
    }
    function reloadReport() {
        getReport(studentId)
    }
    function getReport(studentId) {
        reportElement.html("loading...");
        var getReportUrl = runtime.handlerUrl(element, 'scorm_get_student_state');
        $.ajax({
            url: getReportUrl,
            data: {
                'id': studentId
            },
        }).success(function (data) {
            reportElement.html(renderjson.set_show_to_level(1)(data));
        }).fail(function () {
            reportElement.html("No data found");
        }).complete(function () {
            $(element).find(".reload-report").removeClass("reports-togglable-off");
        });
    }

    // Flag to verify if navigation menu was used to change page
    var navigationClick = false;
        $(element).on("click",".navigation-title", function () {
            var path = $(this).attr('href');
            $(element).find('.scorm-embedded').attr('src', path);
            navigationClick = true;
         });
        
    var scormData = settings.scorm_data || {};
    settings.scorm_data = scormData;

    function formatScormValue(value) {
        if (value === null || typeof value === "undefined") {
            return "";
        }
        return String(value);
    }

    function getMode() {
        return window.location.href.indexOf("preview") >= 0 ? "review" : "normal";
    }

    function cacheInitialScormValues() {
        scormData["cmi.core.lesson_status"] = formatScormValue(settings.lesson_status || "not attempted");
        scormData["cmi.completion_status"] = formatScormValue(settings.lesson_status || "not attempted");
        scormData["cmi.success_status"] = formatScormValue(settings.success_status || "unknown");
        scormData["cmi.core.score.raw"] = formatScormValue((settings.lesson_score || 0) * 100);
        scormData["cmi.score.raw"] = scormData["cmi.core.score.raw"];
        scormData["cmi.score.scaled"] = formatScormValue(settings.lesson_score || 0);
        scormData["cmi.core.lesson_mode"] = getMode();
        scormData["cmi.mode"] = getMode();
    }

    function cacheScoreValue(cmi_element, value) {
        var score = parseFloat(value);
        if (isNaN(score)) {
            return;
        }
        if (cmi_element === "cmi.score.scaled") {
            scormData["cmi.score.scaled"] = formatScormValue(score);
            scormData["cmi.core.score.raw"] = formatScormValue(score * 100);
            scormData["cmi.score.raw"] = scormData["cmi.core.score.raw"];
        } else if (cmi_element === "cmi.core.score.raw" || cmi_element === "cmi.score.raw") {
            scormData["cmi.core.score.raw"] = formatScormValue(score);
            scormData["cmi.score.raw"] = scormData["cmi.core.score.raw"];
            scormData["cmi.score.scaled"] = formatScormValue(score / 100);
        }
    }

    function cacheScormValue(cmi_element, value) {
        value = formatScormValue(value);
        scormData[cmi_element] = value;

        if (cmi_element === "cmi.core.lesson_status") {
            if (value === "passed" || value === "failed") {
                scormData["cmi.success_status"] = value;
            }
            if (value === "passed") {
                scormData["cmi.completion_status"] = "completed";
            } else if (value === "completed" || value === "incomplete" || value === "not attempted" || value === "browsed") {
                scormData["cmi.completion_status"] = value;
            }
        } else if (cmi_element === "cmi.completion_status") {
            scormData["cmi.core.lesson_status"] = value;
        } else if (cmi_element === "cmi.success_status") {
            scormData["cmi.success_status"] = value;
        } else if (cmi_element === "cmi.core.score.raw" || cmi_element === "cmi.score.raw" || cmi_element === "cmi.score.scaled") {
            cacheScoreValue(cmi_element, value);
        }
    }

    cacheInitialScormValues();

    var GetValue = function (cmi_element) {
        if (cmi_element === "cmi.core.lesson_mode" || cmi_element === "cmi.mode") {
            navigationClick = false;
            return getMode();
        }
        if (cmi_element in scormData) {
            navigationClick = false;
            return formatScormValue(scormData[cmi_element]);
        }
        navigationClick = false;
        return "";
    };
    
    var setValueEvents = [];
    var processingSetValueEventsQueue = false;
    var setValueFlushTimeout = null;
    var setValueFlushDelay = settings.set_value_flush_delay || 250;
    var setValuesUrl = runtime.handlerUrl(element, 'scorm_set_values');
    var SetValue = function (cmi_element, value) {
        SetValueAsync(cmi_element, value);
        return "true";
    }
    function SetValueAsync(cmi_element, value) {
        cacheScormValue(cmi_element, value);
        setValueEvents.push([cmi_element, value]);
        scheduleSetValueFlush(setValueFlushDelay);
    }
    function scheduleSetValueFlush(delay) {
        if (processingSetValueEventsQueue) {
            return;
        }
        if (setValueFlushTimeout) {
            clearTimeout(setValueFlushTimeout);
        }
        setValueFlushTimeout = setTimeout(function () {
            setValueFlushTimeout = null;
            processSetValueQueueItems();
        }, delay);
    }
    function FlushSetValueQueue() {
        if (setValueFlushTimeout) {
            clearTimeout(setValueFlushTimeout);
            setValueFlushTimeout = null;
        }
        processSetValueQueueItems();
        return "true";
    }
    function processSetValueQueueItems() {
        if (processingSetValueEventsQueue) {
            return;
        }
        if (setValueEvents.length === 0) {
            // Exit if there is no event left in the queue
            processingSetValueEventsQueue = false;
            return;
        }
        processingSetValueEventsQueue = true;
        var data = [];
        while (setValueEvents.length > 0) {
            var params = setValueEvents.shift();
            var cmi_element = params[0];
            var value = params[1];
            data.push({
                'name': cmi_element,
                'value': value
            })
        }
        $.ajax({
            type: "POST",
            url: setValuesUrl,
            data: JSON.stringify(data),
            success: function (results) {
                for (var i = 0; i < results.length; i += 1) {
                    var result = results[i];
                    if (typeof result.grade != "undefined") {
                        // Properly display at most two decimals
                        $(element).find(".grade").html(Math.round(result.grade * 100) / 100);
                    }
                    if (typeof result.completion_status != "undefined") {
                        $(element).find(".completion-status").html(result.completion_status);
                    }
                }
            },
            complete: function () {
                processingSetValueEventsQueue = false;
                if (setValueEvents.length > 0) {
                    scheduleSetValueFlush(0);
                }
            }
        });
    };

    $(function ($) {
        initScorm(settings.scorm_version, GetValue, SetValue, FlushSetValueQueue);
        initFullscreen();
        initPopupWindow();
        initReports();
    });
}
