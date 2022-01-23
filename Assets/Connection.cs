using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;
using System.Net;
using System;
using System.Linq;
using System.Text;
using System.Net.Sockets;
using System.Threading;

public class NetworkInfo
{
    public string eventType { get; set; }
    public string playerId { get; set; }
    public string eventData { get; set; }
}

public class Connection : MonoBehaviour
{
    public GameObject playerPrefab;
    public GameObject cameraPrefab;
    private GameObject cameraInstance;
    private string playerId;
    private Dictionary<string, GameObject> map;
    public Vector3 offset;
    private ArrayList newEvents;
    private UdpClient udpClient;
    private Int32 connectionSequenceNumber = 1;
    private Thread thread1;

    private ArrayList mySyncedAL;
    // Start is called before the first frame update


    private Int32 remoteSequenceNumber = 0;

    private Int32 ackBitField = 0;

    private float waitTime = 1.0f / 2.0f;
    private float timer = 0.0f;
    private void udpReciever()
    {

        while (true)
        {
            IPEndPoint RemoteIpEndPoint = new IPEndPoint(IPAddress.Any, 0);

            Byte[] receiveBytes = udpClient.Receive(ref RemoteIpEndPoint);
            string returnData = Encoding.ASCII.GetString(receiveBytes);
            // ArraySegment<Byte> remoteSeqArraySegment = new ArraySegment<Byte>(receiveBytes, 4, 4);

            // Byte[] remoteSeq = remoteSeqArraySegment.Array;
            Int32 previousRemoteSeq = remoteSequenceNumber;
            remoteSequenceNumber = BitConverter.ToInt32(receiveBytes.Skip(4).Take(4).ToArray(), 0);
            Int32 remoteSeqDiff = remoteSequenceNumber - previousRemoteSeq;

            ackBitField = ackBitField << remoteSeqDiff;

            Debug.Log(returnData);

        }
        // mySyncedAL.Add(returnData);
        // Uses the IPEndPoint object to determine which of these two hosts responded.
        // Console.WriteLine("This is the message you received " +
        // 														 returnData.ToString());
        // Console.WriteLine("This message was sent from " +
        // 														RemoteIpEndPoint.Address.ToString() +
        // 														" on their port number " +
        // 														RemoteIpEndPoint.Port.ToString());

        // udpClient.Close();
    }

    void Start()
    {
        udpClient = new UdpClient(0);
        udpClient.Connect("localhost", 41234);
        thread1 = new Thread(udpReciever);
        thread1.Start();
        // newEvents = new ArrayList();
        // mySyncedAL = ArrayList.Synchronized( newEvents );


    }

    void Update()
    {

        // 	foreach (string newEvent in mySyncedAL){
        // 	Debug.Log(newEvent);
        // }

        // mySyncedAL.Clear();
        float xDirection = Input.GetAxis("Horizontal");
        float zDirection = Input.GetAxis("Vertical");

        timer += Time.deltaTime;

        if (timer > waitTime)
        {
            timer = timer - waitTime;
            NetworkInfo packet = new NetworkInfo();
            packet.playerId = playerId;
            packet.eventType = "MoveEvent";
            packet.eventData = xDirection.ToString() + "," + zDirection.ToString();
            string sendPacket = JsonConvert.SerializeObject(packet);
            connectionSequenceNumber += 1;
            Byte[] gameProtocol = Encoding.UTF8.GetBytes("5eee");

            Byte[] playerInfo = Encoding.UTF8.GetBytes(sendPacket);

            Byte[] sequenceNumberToSend = BitConverter.GetBytes(connectionSequenceNumber);

            Byte[] remoteSequenceNumberToSend = BitConverter.GetBytes(remoteSequenceNumber);
            Byte[] ackBitFieldBytes = BitConverter.GetBytes(ackBitField);

            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(sequenceNumberToSend);
            }

            List<Byte[]> stuffToSend = new List<Byte[]> { gameProtocol, sequenceNumberToSend, remoteSequenceNumberToSend };
            Byte[] finalPacket = new Byte[16 + playerInfo.Length];
            int byteCount = 0;


            // System.Buffer.BlockCopy (System.Array src, System.Int32 srcOffset, System.Array dst, System.Int32 dstOffset, System.Int32 count) 
            foreach (Byte[] stuff in stuffToSend)
            {
                Buffer.BlockCopy(stuff, 0, finalPacket, byteCount, stuff.Length);
                byteCount += stuff.Length;
            }

            udpClient.Send(finalPacket, finalPacket.Length);
        }
    }
}