$(document).ready(function () {
  const devCode = "IamAbhishek67";

  $("#adminAccessBtn").click(function (e) {
    e.preventDefault();
    $("#adminVerifyModal").modal("show");
  });

  $("#verifyBtn").click(function () {
    const inputVal = $("#verifyInput").val().trim();
    if (inputVal === devCode) {
      $("#verifyMessage")
        .text("✅ Verified! Redirecting...")
        .removeClass("text-danger")
        .addClass("text-success");

      setTimeout(() => {
        window.location.href = "/admin";
      }, 1000);
    } else {
      $("#verifyMessage")
        .text("❌ Incorrect code. Access denied!")
        .removeClass("text-success")
        .addClass("text-danger");

      setTimeout(() => {
        $("#adminVerifyModal").modal("hide");
        $("#verifyInput").val("");
      }, 1500);
    }
  });
});
