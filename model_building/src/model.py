
import torch
import torch.nn as nn
import torch.nn.functional as F

class DeepLOB(nn.Module):
    def __init__(self, y_len=3):
        super(DeepLOB, self).__init__()
        self.y_len = y_len
        
        # Convolution blocks
        # 1st block
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=16, kernel_size=(1, 2), stride=(1, 2))
        self.conv2 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(4, 1), padding='same')
        self.conv3 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(4, 1), padding='same')

        # 2nd block
        self.conv2_1 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(1, 2), stride=(1, 2))
        self.conv2_2 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(4, 1), padding='same')
        self.conv2_3 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(4, 1), padding='same')

        # 3rd block
        self.conv3_1 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(1, 10))
        self.conv3_2 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(4, 1), padding='same')
        self.conv3_3 = nn.Conv2d(in_channels=16, out_channels=16, kernel_size=(4, 1), padding='same')
        
        # Inception Module
        self.inp1 = nn.Conv2d(in_channels=16, out_channels=32, kernel_size=(1, 1), padding='same')
        self.inp2 = nn.Conv2d(in_channels=32, out_channels=32, kernel_size=(3, 1), padding='same')
        
        self.inp3 = nn.Conv2d(in_channels=16, out_channels=32, kernel_size=(1, 1), padding='same')
        self.inp4 = nn.Conv2d(in_channels=32, out_channels=32, kernel_size=(5, 1), padding='same')
        
        self.inp5 = nn.MaxPool2d((3, 1), stride=(1, 1), padding=(1, 0))
        self.inp6 = nn.Conv2d(in_channels=16, out_channels=32, kernel_size=(1, 1), padding='same')
        
        # LSTM
        self.lstm = nn.LSTM(input_size=96, hidden_size=64, num_layers=1, batch_first=True)
        self.fc1 = nn.Linear(64, self.y_len)

    def forward(self, x):
        # x shape: (N, 1, 100, 40)
        
        # Block 1
        x = self.conv1(x)
        x = F.leaky_relu(x)
        x = self.conv2(x)
        x = F.leaky_relu(x)
        x = self.conv3(x)
        x = F.leaky_relu(x)
        
        # Block 2
        x = self.conv2_1(x)
        x = F.leaky_relu(x)
        x = self.conv2_2(x)
        x = F.leaky_relu(x)
        x = self.conv2_3(x)
        x = F.leaky_relu(x)
        
        # Block 3
        x = self.conv3_1(x)
        x = F.leaky_relu(x)
        x = self.conv3_2(x)
        x = F.leaky_relu(x)
        x = self.conv3_3(x)
        x = F.leaky_relu(x)
        
        # Inception module
        x_inp1 = self.inp1(x)
        x_inp1 = F.leaky_relu(x_inp1)
        x_inp1 = self.inp2(x_inp1)
        x_inp1 = F.leaky_relu(x_inp1)
        
        x_inp2 = self.inp3(x)
        x_inp2 = F.leaky_relu(x_inp2)
        x_inp2 = self.inp4(x_inp2)
        x_inp2 = F.leaky_relu(x_inp2)
        
        x_inp3 = self.inp5(x)
        x_inp3 = self.inp6(x_inp3)
        x_inp3 = F.leaky_relu(x_inp3)
        
        x = torch.cat((x_inp1, x_inp2, x_inp3), dim=1) # dim 1 is channels (32+32+32 = 96)
        
        # Reshape for LSTM: (N, Features, Time, 1) -> (N, Time, Features)
        # Current shape after Inception: (N, 96, 100, 1)
        # Permute to (N, 100, 96)
        
        x = x.reshape(x.shape[0], 96, 100)
        x = x.permute(0, 2, 1)
        
        x, _ = self.lstm(x)
        
        # Last output of LSTM
        x = x[:, -1, :]
        
        x = self.fc1(x)
        return x

if __name__ == '__main__':
    # Verify shapes
    model = DeepLOB()
    # Input: (Batch, Channel, Height, Width) -> (1, 1, 100, 40)
    x = torch.randn(1, 1, 100, 40)
    y = model(x)
    print(f"Output shape: {y.shape}") # Expect (1, 3)
