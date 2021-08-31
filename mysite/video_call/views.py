from django.shortcuts import render
from django.http import HttpResponse
from mysite.utils import get_turn_info
# Create your views here.
def welcome(request):
    data=request.POST.get('username')
    return render(request,"videocall/CallPage.html",{'data':data})

def home(request):
    return render(request,"Enter_meeting/Enter_meeting.html")
